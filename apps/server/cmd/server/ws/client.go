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
	sendMsg(c, msgType, payload)
}

func (c *Client) SendRaw(data []byte) error {
	return c.conn.WriteMessage(data)
}

func (c *Client) Disconnect() {
	c.conn.Close()
}
