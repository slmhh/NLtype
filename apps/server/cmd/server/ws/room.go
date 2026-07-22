package ws

import (
	cryptorand "crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

func generateID() string {
	b := make([]byte, 4)
	cryptorand.Read(b)
	return hex.EncodeToString(b)
}

func generateCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	cryptorand.Read(b)
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}

type PlayerState struct {
	Client        *Client
	Progress      int
	WPM           float64
	Accuracy      float64
	CPM           float64
	RawWPM        float64
	Finished      bool
	Ready         bool
	Eliminated    bool
	Team          string
	Role          string
	FinishedAt    time.Time
	StartPos      int
	Items         []ItemType
	SpeedBoostEnd time.Time
	SlowEnd       time.Time
	HasShield     bool
}

type Room struct {
	ID        string
	Code      string
	Name      string
	Status    RoomStatus
	Settings  RoomSettings
	HostID    int
	CreatedAt time.Time

	mu        sync.RWMutex
	Players   map[int]*PlayerState
	PlayerIdx []int
	Text      string

	StartTime   time.Time
	Duration    int
	ticker      *time.Ticker
	stopTicker  chan struct{}
	elimTick    int
	chaseCopID    int
	chaseRobberID int
	chaseMapLen   int
	chaseItems    []ItemPos
	aiNextID    int
	aiDone      chan struct{}
}

type UserInfo struct {
	ID       int
	Username string
	Role     string
}

func NewRoom(settings RoomSettings, hostUser *UserInfo) *Room {
	id := generateID()
	code := generateCode()
	aiNext := -2
	if settings.AIEnabled && settings.AICount > 0 {
		aiNext = -2 - settings.AICount
	}
	return &Room{
		ID:        id,
		Code:      code,
		Name:      fmt.Sprintf("Room %s", code),
		Status:    StatusWaiting,
		Settings:  settings,
		HostID:    hostUser.ID,
		CreatedAt: time.Now(),
		Players:   make(map[int]*PlayerState),
		PlayerIdx: make([]int, 0),
		aiNextID:  aiNext,
	}
}

func (r *Room) AddPlayer(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.Players[c.UserID]; exists {
		return
	}

	team := ""
	if r.Settings.Mode == ModeTeamBattle {
		if len(r.PlayerIdx)%2 == 0 {
			team = "red"
		} else {
			team = "blue"
		}
	}

	role := ""
	if r.Settings.Mode == ModeChase {
		if len(r.PlayerIdx) == 0 {
			role = "cop"
		} else {
			role = "robber"
		}
	}

	r.Players[c.UserID] = &PlayerState{
		Client:   c,
		Team:     team,
		Role:     role,
		StartPos: 0,
	}
	r.PlayerIdx = append(r.PlayerIdx, c.UserID)

	if len(r.PlayerIdx) == 1 {
		r.HostID = c.UserID
	}
}

func (r *Room) RemovePlayer(userID int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.Players, userID)
	idx := -1
	for i, id := range r.PlayerIdx {
		if id == userID {
			idx = i
			break
		}
	}
	if idx >= 0 {
		r.PlayerIdx = append(r.PlayerIdx[:idx], r.PlayerIdx[idx+1:]...)
	}

	if r.HostID == userID && len(r.PlayerIdx) > 0 {
		r.HostID = r.PlayerIdx[0]
	}
}

func (r *Room) SetReady(userID int, ready bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.Players[userID]; ok {
		p.Ready = ready
	}
}

func (r *Room) AllReady() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.PlayerIdx) < 2 {
		return false
	}
	for _, id := range r.PlayerIdx {
		p := r.Players[id]
		if !p.Ready && id != r.HostID {
			return false
		}
	}
	return true
}

func (r *Room) PlayerList() []PlayerInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]PlayerInfo, 0, len(r.PlayerIdx))
	for _, id := range r.PlayerIdx {
		p := r.Players[id]
		effects := make([]string, 0)
		if time.Now().Before(p.SpeedBoostEnd) {
			effects = append(effects, "speed_boost")
		}
		if time.Now().Before(p.SlowEnd) {
			effects = append(effects, "slow")
		}
		if p.HasShield {
			effects = append(effects, "shield")
		}

		list = append(list, PlayerInfo{
			UserID:     id,
			Username:   p.Client.Username,
			Progress:   p.Progress,
			WPM:        p.WPM,
			Accuracy:   p.Accuracy,
			Position:   0,
			Eliminated: p.Eliminated,
			Team:       p.Team,
			Role:       p.Role,
			Finished:   p.Finished,
			Ready:      p.Ready,
			Items:      p.Items,
			Effects:    effects,
		})
	}
	return list
}

func (r *Room) GetRoomInfo() RoomInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return RoomInfo{
		ID:        r.ID,
		Code:      r.Code,
		Name:      r.Name,
		Status:    r.Status,
		Mode:      r.Settings.Mode,
		Players:   r.PlayerList(),
		Settings:  r.Settings,
		HostID:    r.HostID,
		CreatedAt: r.CreatedAt.Unix(),
	}
}

func (r *Room) Broadcast(msgType string, payload interface{}) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Players {
		p.Client.Send(msgType, payload)
	}
}

func (r *Room) broadcastExcept(userID int, msgType string, payload interface{}) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Players {
		if p.Client.UserID != userID {
			p.Client.Send(msgType, payload)
		}
	}
}
