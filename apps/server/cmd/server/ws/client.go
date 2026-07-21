package ws

// Client represents a single WebSocket connection with user info.
type Client struct {
	conn     *Conn
	UserID   int
	Username string
	Role     string // "user", "admin", "developer"
	RoomID   string
}

func NewClient(conn *Conn, userID int, username, role string) *Client {
	return &Client{
		conn:     conn,
		UserID:   userID,
		Username: username,
		Role:     role,
	}
}

func (c *Client) Send(msgType string, payload interface{}) {
	if c.conn == nil {
		return
	}
	sendMsg(c, msgType, payload)
}

func (c *Client) SendRaw(data []byte) error {
	if c.conn == nil {
		return nil
	}
	return c.conn.WriteMessage(data)
}

func (c *Client) Disconnect() {
	if c.conn != nil {
		c.conn.Close()
	}
}
