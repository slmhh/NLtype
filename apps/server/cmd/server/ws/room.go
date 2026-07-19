package ws

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"sync"
	"time"
)

func generateID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	rand.Read(b)
	for i := range b {
		b[i] = chars[int(b[i])%len(chars)]
	}
	return string(b)
}

type PlayerState struct {
	Client     *Client
	Progress   int
	WPM        float64
	Accuracy   float64
	CPM        float64
	RawWPM     float64
	Finished   bool
	Ready      bool
	Eliminated bool
	Team       string
	Role       string
	FinishedAt time.Time
	StartPos   int // for chase mode, starting position offset
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
	PlayerIdx []int // ordered player IDs
	Text      string

	// Game state
	StartTime  time.Time
	Duration   int
	ticker     *time.Ticker
	stopTicker chan struct{}
	elimTick   int // elimination tick counter
}

func NewRoom(settings RoomSettings, hostUser *UserInfo) *Room {
	id := generateID()
	code := generateCode()
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
	}
}

type UserInfo struct {
	ID       int
	Username string
	Role     string
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

	// Auto-set host if first player
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

	// Transfer host if needed
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
		})
	}
	return list
}

func (r *Room) GetRoomInfo() RoomInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return RoomInfo{
		ID:     r.ID,
		Code:   r.Code,
		Name:   r.Name,
		Status: r.Status,
		Mode:   r.Settings.Mode,
		Players: r.PlayerList(),
		Settings: r.Settings,
		HostID: r.HostID,
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

func (r *Room) BroadcastRaw(data []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Players {
		p.Client.SendRaw(data)
	}
}

func (r *Room) StartGame() {
	r.mu.Lock()
	if r.Status != StatusWaiting {
		r.mu.Unlock()
		return
	}
	r.Status = StatusCountdown
	r.Text = generateGameText(r.Settings)
	r.mu.Unlock()

	// Countdown 3..2..1
	for i := 3; i > 0; i-- {
		r.Broadcast(MsgGameCountdown, map[string]int{"count": i})
		time.Sleep(1 * time.Second)
	}
	r.Broadcast(MsgGameCountdown, map[string]int{"count": 0})

	r.mu.Lock()
	r.Status = StatusPlaying
	r.StartTime = time.Now()
	r.Duration = r.Settings.Duration
	r.mu.Unlock()

	r.Broadcast(MsgGameStart, map[string]interface{}{
		"text":   r.Text,
		"mode":   r.Settings.Mode,
		"duration": r.Duration,
	})

	// Start game ticker for sync broadcasts and mode-specific logic
	r.stopTicker = make(chan struct{})
	r.ticker = time.NewTicker(200 * time.Millisecond)
	r.elimTick = 0

	go func() {
		for {
			select {
			case <-r.ticker.C:
				r.tick()
			case <-r.stopTicker:
				return
			}
		}
	}()

	// Auto-end for timed modes
	if r.Duration > 0 {
		time.AfterFunc(time.Duration(r.Duration)*time.Second, func() {
			r.EndGame()
		})
	}
}

func (r *Room) tick() {
	r.mu.RLock()
	if r.Status != StatusPlaying {
		r.mu.RUnlock()
		return
	}
	mode := r.Settings.Mode
	r.mu.RUnlock()

	// Broadcast sync
	r.Broadcast(MsgGameSync, r.getSyncPayload())

	// Elimination mode check
	if mode == ModeElimination {
		r.mu.Lock()
		r.elimTick++
		// Every 30 seconds (150 ticks at 200ms)
		if r.elimTick >= 150 && len(r.PlayerIdx) > 1 {
			r.elimTick = 0
			r.doEliminationTick()
		}
		r.mu.Unlock()
	}
}

func (r *Room) getSyncPayload() GameSyncPayload {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]PlayerInfo, 0, len(r.PlayerIdx))

	// Sort by WPM descending for ranking
	type ranked struct {
		id  int
		wpm float64
	}
	sorted := make([]ranked, 0, len(r.PlayerIdx))
	for _, id := range r.PlayerIdx {
		p := r.Players[id]
		sorted = append(sorted, ranked{id, p.WPM})
	}
	// Bubble sort by WPM desc
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].wpm > sorted[i].wpm {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	posMap := make(map[int]int)
	for i, s := range sorted {
		posMap[s.id] = i + 1
	}

	for _, id := range r.PlayerIdx {
		p := r.Players[id]
		players = append(players, PlayerInfo{
			UserID:     id,
			Username:   p.Client.Username,
			Progress:   p.Progress,
			WPM:        math.Round(p.WPM*100) / 100,
			Accuracy:   math.Round(p.Accuracy*100) / 100,
			Position:   posMap[id],
			Eliminated: p.Eliminated,
			Team:       p.Team,
			Role:       p.Role,
			Finished:   p.Finished,
		})
	}

	timeLeft := 0
	if r.Duration > 0 {
		elapsed := int(time.Since(r.StartTime).Seconds())
		timeLeft = r.Duration - elapsed
		if timeLeft < 0 {
			timeLeft = 0
		}
	}

	return GameSyncPayload{
		Players:  players,
		TimeLeft: timeLeft,
	}
}

func (r *Room) UpdateProgress(userID int, prog *GameProgressPayload) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.Players[userID]
	if !ok || p.Finished || p.Eliminated {
		return
	}

	p.Progress = prog.Position
	p.WPM = prog.WPM
	p.Accuracy = prog.Accuracy
	p.Finished = prog.Finished
	if prog.Finished {
		p.FinishedAt = time.Now()
	}

	// Check if all finished (for non-timed race modes)
	if r.Settings.Mode == ModeRace || r.Settings.Mode == ModeAccuracy || r.Settings.Mode == ModeChase {
		allFinished := true
		for _, ps := range r.Players {
			if !ps.Finished && !ps.Eliminated {
				allFinished = false
				break
			}
		}
		if allFinished {
			go r.EndGame()
		}
	}
}

func (r *Room) doEliminationTick() {
	if len(r.PlayerIdx) <= 1 {
		return
	}

	// Find lowest WPM among non-eliminated
	lowestID := -1
	lowestWPM := math.MaxFloat64
	for _, id := range r.PlayerIdx {
		p := r.Players[id]
		if p.Eliminated || p.Finished {
			continue
		}
		if p.WPM < lowestWPM {
			lowestWPM = p.WPM
			lowestID = id
		}
	}

	if lowestID >= 0 {
		r.Players[lowestID].Eliminated = true
		r.Broadcast(MsgPlayerEliminated, map[string]interface{}{
			"userId":   lowestID,
			"reason": "lowest_wpm",
		})
	}

	// Check if only 1 remains
	active := 0
	for _, id := range r.PlayerIdx {
		if !r.Players[id].Eliminated {
			active++
		}
	}
	if active <= 1 {
		go r.EndGame()
	}
}

func (r *Room) EndGame() {
	r.mu.Lock()
	if r.Status == StatusResult {
		r.mu.Unlock()
		return
	}
	r.Status = StatusResult
	if r.ticker != nil {
		r.ticker.Stop()
		r.stopTicker <- struct{}{}
	}
	r.mu.Unlock()

	results := r.collectResults()
	r.Broadcast(MsgGameResult, GameResultPayload{Results: results})
}

func (r *Room) collectResults() []PlayerResult {
	r.mu.RLock()
	defer r.mu.RUnlock()

	results := make([]PlayerResult, 0, len(r.PlayerIdx))
	for _, id := range r.PlayerIdx {
		p := r.Players[id]
		results = append(results, PlayerResult{
			PlayerInfo: PlayerInfo{
				UserID:     id,
				Username:   p.Client.Username,
				Progress:   p.Progress,
				WPM:        math.Round(p.WPM*100) / 100,
				Accuracy:   math.Round(p.Accuracy*100) / 100,
				Eliminated: p.Eliminated,
				Team:       p.Team,
				Role:       p.Role,
				Finished:   p.Finished,
			},
			CPM:      math.Round(p.CPM*100) / 100,
			RawWPM:   math.Round(p.RawWPM*100) / 100,
			Duration: time.Since(r.StartTime).Seconds(),
		})
	}

	// Sort by WPM desc
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].WPM > results[i].WPM {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
	// Assign positions
	for i := range results {
		results[i].Position = i + 1
	}

	return results
}

func (r *Room) Rematch(userID int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Reset all players
	for _, p := range r.Players {
		p.Progress = 0
		p.WPM = 0
		p.Accuracy = 0
		p.CPM = 0
		p.RawWPM = 0
		p.Finished = false
		p.Ready = false
		p.Eliminated = false
		p.FinishedAt = time.Time{}
	}
	r.Status = StatusWaiting
	r.Text = ""

	r.Broadcast(MsgRoomUpdate, r.GetRoomInfo())
}

func generateGameText(settings RoomSettings) string {
	// For now, use a placeholder text
	// In production, this would pull from the entries/words database
	return "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump. The five boxing wizards jump quickly. Sphinx of black quartz, judge my vow."
}

func init() {
	// Ensure hostID consistency on player add
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
