package ws

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	magicGUID   = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	readLimit   = 65536
	writeWait   = 10 * time.Second
	pongWait    = 60 * time.Second
	pingPeriod  = 30 * time.Second
	maxFrameLen = 65536
)

type OpCode byte

const (
	OpText   OpCode = 1
	OpClose  OpCode = 8
	OpPing   OpCode = 9
	OpPong   OpCode = 10
)

type Conn struct {
	conn   net.Conn
	br     *bufio.Reader
	bw     *bufio.Writer
	mu     sync.Mutex
	closed bool
}

func computeAcceptKey(key string) string {
	h := sha1.New()
	h.Write([]byte(key + magicGUID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func Upgrade(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return nil, errors.New("not a websocket upgrade request")
	}
	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		return nil, errors.New("missing Sec-WebSocket-Key")
	}

	hj, ok := w.(http.Hijacker)
	if !ok {
		return nil, errors.New("server does not support hijacking")
	}
	nc, bufrw, err := hj.Hijack()
	if err != nil {
		return nil, fmt.Errorf("hijack: %w", err)
	}

	accept := computeAcceptKey(key)
	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
	if _, err := bufrw.WriteString(resp); err != nil {
		nc.Close()
		return nil, err
	}
	if err := bufrw.Flush(); err != nil {
		nc.Close()
		return nil, err
	}

	return &Conn{
		conn: nc,
		br:   bufrw.Reader,
		bw:   bufrw.Writer,
	}, nil
}

func (c *Conn) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	c.closed = true
	return c.conn.Close()
}

func (c *Conn) WriteMessage(data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return errors.New("connection closed")
	}
	// Write frame: FIN=1, opcode=text, mask=0
	// Byte 0: 0x81 (FIN + OpText)
	frame := []byte{0x81}
	// Byte 1+: payload length (unmasked)
	writeLen(c.conn, frame, &data)
	return nil
}

func writeLen(w io.Writer, frame []byte, data *[]byte) error {
	l := len(*data)
	if l <= 125 {
		frame = append(frame, byte(l))
	} else if l <= 65535 {
		frame = append(frame, 126, byte(l>>8), byte(l))
	} else {
		frame = append(frame, 127)
		b := make([]byte, 8)
		binary.BigEndian.PutUint64(b, uint64(l))
		frame = append(frame, b...)
	}
	if _, err := w.Write(frame); err != nil {
		return err
	}
	if _, err := w.Write(*data); err != nil {
		return err
	}
	return nil
}

type message struct {
	data []byte
	op   OpCode
}

func (c *Conn) ReadMessage() ([]byte, error) {
	for {
		msg, err := c.readFrame()
		if err != nil {
			return nil, err
		}
		switch msg.op {
		case OpText:
			return msg.data, nil
		case OpClose:
			return nil, io.EOF
		case OpPing:
			c.writePong(msg.data)
		case OpPong:
			// ignore
		}
	}
}

func (c *Conn) readFrame() (*message, error) {
	header := make([]byte, 2)
	if _, err := io.ReadFull(c.br, header); err != nil {
		return nil, err
	}
	op := OpCode(header[0] & 0x0F)
	masked := (header[1] & 0x80) != 0
	length := int64(header[1] & 0x7F)

	switch {
	case length == 126:
		buf := make([]byte, 2)
		if _, err := io.ReadFull(c.br, buf); err != nil {
			return nil, err
		}
		length = int64(binary.BigEndian.Uint16(buf))
	case length == 127:
		buf := make([]byte, 8)
		if _, err := io.ReadFull(c.br, buf); err != nil {
			return nil, err
		}
		length = int64(binary.BigEndian.Uint64(buf))
	}

	if length > maxFrameLen {
		return nil, errors.New("frame too large")
	}

	var maskKey [4]byte
	if masked {
		if _, err := io.ReadFull(c.br, maskKey[:]); err != nil {
			return nil, err
		}
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(c.br, data); err != nil {
		return nil, err
	}

	if masked {
		for i := range data {
			data[i] ^= maskKey[i%4]
		}
	}

	return &message{data: data, op: op}, nil
}

func (c *Conn) WritePing() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	frame := []byte{0x89, 0x00} // FIN=1, OpPing, length=0
	_, err := c.conn.Write(frame)
	return err
}

func (c *Conn) writePong(data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	frame := []byte{0x8A}
	writeLen(c.conn, frame, &data)
	return nil
}

func (c *Conn) writeClose() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	c.closed = true
	frame := []byte{0x88, 0x00}
	c.conn.Write(frame)
	return c.conn.Close()
}

func (c *Conn) RemoteAddr() string {
	return c.conn.RemoteAddr().String()
}

func (c *Conn) SetReadDeadline(t time.Time) {
	c.conn.SetReadDeadline(t)
}
