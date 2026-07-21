package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

type Hub struct {
	mu       sync.RWMutex
	clients  map[*Client]bool
	rooms    map[string]*Room
	Register chan *Client
}

var DefaultHub = &Hub{
	clients:  make(map[*Client]bool),
	rooms:    make(map[string]*Room),
	Register: make(chan *Client, 256),
}

func (h *Hub) Run() {
	for c := range h.Register {
		h.mu.Lock()
		h.clients[c] = true
		h.mu.Unlock()
		go h.handleClient(c)
	}
}

func (h *Hub) handleClient(c *Client) {
	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))

	// Periodic ping to keep connection alive
	pingTicker := time.NewTicker(pingPeriod)
	defer pingTicker.Stop()
	go func() {
		for range pingTicker.C {
			c.conn.WritePing()
		}
	}()

	for {
		data, err := c.conn.ReadMessage()
		if err != nil {
			if c.RoomID != "" {
				h.handleLeave(c)
			}
			return
		}
		c.conn.SetReadDeadline(time.Now().Add(pongWait))

		var msg WSMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}
		h.dispatch(c, &msg)
	}
}

func (h *Hub) dispatch(c *Client, msg *WSMessage) {
	switch msg.Type {
	case MsgCreateRoom:
		h.handleCreateRoom(c, msg.Payload)
	case MsgJoinRoom:
		h.handleJoinRoom(c, msg.Payload)
	case MsgLeaveRoom:
		h.handleLeave(c)
	case MsgListRooms:
		h.handleListRooms(c)
	case MsgSetReady:
		h.handleSetReady(c, msg.Payload)
	case MsgStartGame:
		h.handleStartGame(c)
	case MsgGameProgress:
		h.handleGameProgress(c, msg.Payload)
	case MsgChat:
		h.handleChat(c, msg.Payload)
	case MsgRematch:
		h.handleRematch(c)
	case MsgUseItem:
		h.handleUseItem(c, msg.Payload)
	}
}

func (h *Hub) handleCreateRoom(c *Client, payload interface{}) {
	var settings RoomSettings
	if err := marshalPayload(payload, &settings); err != nil {
		sendError(c, "invalid settings")
		return
	}
	if settings.Mode == "" {
		settings.Mode = ModeRace
	}
	if settings.MaxPlayers < 2 {
		settings.MaxPlayers = 8
	}
	if settings.Duration <= 0 {
		settings.Duration = 60
	}

	room := NewRoom(settings, &UserInfo{ID: c.UserID, Username: c.Username, Role: c.Role})
	h.mu.Lock()
	h.rooms[room.ID] = room
	h.mu.Unlock()

	c.RoomID = room.ID
	room.AddPlayer(c)

	sendMsg(c, MsgRoomCreated, RoomInfo{
		ID:   room.ID,
		Code: room.Code,
		Name: room.Name,
		Status: room.Status,
		Mode: room.Settings.Mode,
		Players: room.PlayerList(),
		Settings: room.Settings,
		HostID: room.HostID,
		CreatedAt: room.CreatedAt.Unix(),
	})
}

func (h *Hub) handleJoinRoom(c *Client, payload interface{}) {
	var req struct {
		Code     string `json:"code"`
		Password string `json:"password,omitempty"`
	}
	if err := marshalPayload(payload, &req); err != nil {
		sendError(c, "invalid request")
		return
	}

	h.mu.RLock()
	room, ok := h.rooms[req.Code]
	h.mu.RUnlock()

	if !ok {
		// Try by code
		h.mu.RLock()
		for _, r := range h.rooms {
			if r.Code == req.Code {
				room = r
				ok = true
				break
			}
		}
		h.mu.RUnlock()
	}

	if !ok {
		sendError(c, "room not found")
		return
	}

	if room.Settings.Password != "" && room.Settings.Password != req.Password {
		sendError(c, "wrong password")
		return
	}

	if room.Status != StatusWaiting {
		sendError(c, "game already in progress")
		return
	}

	if len(room.Players) >= room.Settings.MaxPlayers {
		sendError(c, "room is full")
		return
	}

	c.RoomID = room.ID
	room.AddPlayer(c)
	room.Broadcast(MsgRoomUpdate, room.GetRoomInfo())
}

func (h *Hub) handleLeave(c *Client) {
	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	room.RemovePlayer(c.UserID)
	c.RoomID = ""

	if len(room.Players) == 0 {
		h.mu.Lock()
		delete(h.rooms, room.ID)
		h.mu.Unlock()
		return
	}

	room.Broadcast(MsgRoomUpdate, room.GetRoomInfo())
}

func (h *Hub) handleListRooms(c *Client) {
	h.mu.RLock()
	rooms := make([]RoomInfo, 0, len(h.rooms))
	for _, r := range h.rooms {
		if r.Status == StatusWaiting {
			rooms = append(rooms, r.GetRoomInfo())
		}
	}
	h.mu.RUnlock()

	sendMsg(c, MsgRoomList, rooms)
}

func (h *Hub) handleSetReady(c *Client, payload interface{}) {
	var req struct {
		Ready bool `json:"ready"`
	}
	if err := marshalPayload(payload, &req); err != nil {
		return
	}

	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	room.SetReady(c.UserID, req.Ready)
	room.Broadcast(MsgRoomUpdate, room.GetRoomInfo())
}

func (h *Hub) handleStartGame(c *Client) {
	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		sendError(c, "not in a room")
		return
	}

	if c.UserID != room.HostID {
		sendError(c, "only the host can start")
		return
	}

	room.StartGame()
}

func (h *Hub) handleGameProgress(c *Client, payload interface{}) {
	var prog GameProgressPayload
	if err := marshalPayload(payload, &prog); err != nil {
		return
	}

	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	room.UpdateProgress(c.UserID, &prog)
}

func (h *Hub) handleChat(c *Client, payload interface{}) {
	var msg struct {
		Text string `json:"text"`
	}
	if err := marshalPayload(payload, &msg); err != nil || msg.Text == "" {
		return
	}

	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	room.Broadcast(MsgChatMsg, map[string]interface{}{
		"userId":   c.UserID,
		"username": c.Username,
		"text":     msg.Text,
	})
}

func (h *Hub) handleUseItem(c *Client, payload interface{}) {
	var req UseItemPayload
	if err := marshalPayload(payload, &req); err != nil {
		return
	}

	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	room.UseItem(c.UserID, req.Item)
}

func (h *Hub) handleRematch(c *Client) {
	h.mu.RLock()
	room, ok := h.rooms[c.RoomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	room.Rematch(c.UserID)
}

func sendMsg(c *Client, msgType string, payload interface{}) {
	msg := WSMessage{Type: msgType, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws marshal error: %v", err)
		return
	}
	c.conn.WriteMessage(data)
}

func sendError(c *Client, msg string) {
	sendMsg(c, MsgError, map[string]string{"message": msg})
}

func marshalPayload(payload interface{}, dest interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}
