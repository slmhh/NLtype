package ws

// GameMode represents a multiplayer game mode.
type GameMode string

const (
	ModeRace       GameMode = "race"
	ModeTimeBattle GameMode = "time_battle"
	ModeAccuracy   GameMode = "accuracy"
	ModeElimination GameMode = "elimination"
	ModeTeamBattle GameMode = "team_battle"
	ModeMarathon   GameMode = "marathon"
	ModeChase      GameMode = "chase"
)

// RoomStatus represents the current state of a room.
type RoomStatus string

const (
	StatusWaiting   RoomStatus = "waiting"
	StatusCountdown RoomStatus = "countdown"
	StatusPlaying   RoomStatus = "playing"
	StatusResult    RoomStatus = "result"
)

// PlayerInfo is sent to clients to describe a player.
type PlayerInfo struct {
	UserID   int     `json:"userId"`
	Username string  `json:"username"`
	Progress int     `json:"progress"`
	WPM      float64 `json:"wpm"`
	Accuracy float64 `json:"accuracy"`
	Position int     `json:"position"`
	Eliminated bool  `json:"eliminated,omitempty"`
	Team     string  `json:"team,omitempty"`
	Role     string  `json:"role,omitempty"` // "cop" or "robber" for chase mode
	Finished bool    `json:"finished"`
	Ready    bool    `json:"ready"`
}

type RoomSettings struct {
	Mode       GameMode `json:"mode"`
	TextSource string   `json:"textSource"` // "words", "quote", "code"
	Duration   int      `json:"duration"`   // seconds, for timed modes
	MaxPlayers int      `json:"maxPlayers"`
	Password   string   `json:"password,omitempty"`
	AIEnabled  bool     `json:"aiEnabled"`
	AICount    int      `json:"aiCount"`
}

type RoomInfo struct {
	ID        string       `json:"id"`
	Code      string       `json:"code"`
	Name      string       `json:"name"`
	Status    RoomStatus   `json:"status"`
	Mode      GameMode     `json:"mode"`
	Players   []PlayerInfo `json:"players"`
	Settings  RoomSettings `json:"settings"`
	HostID    int          `json:"hostId"`
	CreatedAt int64        `json:"createdAt"`
}

// --- WebSocket message types ---

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// Client -> Server messages
const (
	MsgCreateRoom    = "room:create"
	MsgJoinRoom      = "room:join"
	MsgLeaveRoom     = "room:leave"
	MsgListRooms     = "room:list"
	MsgSetReady      = "room:ready"
	MsgStartGame     = "game:start"
	MsgGameProgress  = "game:progress"
	MsgChat          = "room:chat"
	MsgRematch       = "game:rematch"
)

// Server -> Client messages
const (
	MsgRoomCreated   = "room:created"
	MsgRoomJoined    = "room:joined"
	MsgRoomLeft      = "room:left"
	MsgRoomUpdate    = "room:update"
	MsgRoomList      = "room:list"
	MsgGameStart     = "game:starting"
	MsgGameSync      = "game:sync"
	MsgGameResult    = "game:result"
	MsgGameCountdown = "game:countdown"
	MsgError         = "error"
	MsgChatMsg       = "room:chat"
	MsgPlayerEliminated = "game:eliminated"
)

type GameProgressPayload struct {
	Position int     `json:"position"`
	WPM      float64 `json:"wpm"`
	Accuracy float64 `json:"accuracy"`
	Finished bool    `json:"finished"`
}

type GameSyncPayload struct {
	Players  []PlayerInfo  `json:"players"`
	TimeLeft int           `json:"timeLeft,omitempty"`
	Mode     GameMode      `json:"mode,omitempty"`
	ChaseMap *ChaseMapState `json:"chaseMap,omitempty"`
}

type ChaseMapState struct {
	CopPosition    int `json:"copPosition"`
	RobberPosition int `json:"robberPosition"`
	Distance       int `json:"distance"`
	MapLength      int `json:"mapLength"`
}

type GameResultPayload struct {
	Results   []PlayerResult `json:"results"`
	TeamScores []TeamScore   `json:"teamScores,omitempty"`
	ChaseResult *ChaseResult `json:"chaseResult,omitempty"`
}

type TeamScore struct {
	Team      string  `json:"team"`
	AvgWPM    float64 `json:"avgWpm"`
	AvgAcc    float64 `json:"avgAcc"`
	TotalWPM  float64 `json:"totalWpm"`
}

type ChaseResult struct {
	WinnerRole string `json:"winnerRole"`
	WinnerID   int    `json:"winnerId"`
	Reason     string `json:"reason"` // "caught" or "escaped"
}

type PlayerResult struct {
	PlayerInfo
	CPM        float64 `json:"cpm"`
	RawWPM     float64 `json:"rawWPM"`
	Duration   float64 `json:"duration"`
}
