package ws

import (
	cryptorand "crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"math/rand/v2"
	"sort"
	"strings"
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
	PlayerIdx []int // ordered player IDs
	Text      string

	// Game state
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

func (r *Room) broadcastExcept(userID int, msgType string, payload interface{}) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, p := range r.Players {
		if p.Client.UserID != userID {
			p.Client.Send(msgType, payload)
		}
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

	// Add AI players before starting
	r.startAIPlayers()

	r.mu.Lock()
	r.Status = StatusPlaying
	r.StartTime = time.Now()
	r.Duration = r.Settings.Duration
	if r.Settings.Mode == ModeChase {
		r.chaseMapLen = 100
		r.chaseItems = generateChaseItems(r.chaseMapLen)
		for _, id := range r.PlayerIdx {
			p := r.Players[id]
			if p.Role == "cop" {
				r.chaseCopID = id
				p.Progress = 0
			} else {
				r.chaseRobberID = id
				p.Progress = 20 // robber starts ahead
			}
		}
	}
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

	// Auto-end for timed modes (not marathon, not chase)
	if r.Duration > 0 && r.Settings.Mode != ModeMarathon {
		time.AfterFunc(time.Duration(r.Duration)*time.Second, func() {
			r.EndGame()
		})
	}
}

func (r *Room) stopTickerAndEnd() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.Status == StatusResult {
		return
	}
	r.Status = StatusResult
	if r.ticker != nil {
		r.ticker.Stop()
		select {
		case r.stopTicker <- struct{}{}:
		default:
		}
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

	r.mu.Lock()
	defer r.mu.Unlock()

	// Elimination mode
	if mode == ModeElimination {
		r.elimTick++
		if r.elimTick >= 150 && len(r.PlayerIdx) > 1 {
			r.elimTick = 0
			r.doEliminationTick()
		}
	}

	// Chase mode: update positions based on progress
	if mode == ModeChase && r.doChaseTick() {
		r.mu.Unlock()
		r.stopTickerAndEnd()
		return
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
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[j].wpm < sorted[i].wpm
	})
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

	payload := GameSyncPayload{
		Players:  players,
		TimeLeft: timeLeft,
		Mode:     r.Settings.Mode,
	}

	// Chase mode map state
	if r.Settings.Mode == ModeChase {
		copPos := 0
		robberPos := 20
		if cp, ok := r.Players[r.chaseCopID]; ok {
			copPos = cp.Progress
		}
		if rp, ok := r.Players[r.chaseRobberID]; ok {
			robberPos = rp.Progress
		}
		// Only send items the player hasn't passed yet
		visibleItems := make([]ItemPos, 0)
		for _, ip := range r.chaseItems {
			if ip.Collected {
				continue
			}
			visibleItems = append(visibleItems, ip)
		}
		payload.ChaseMap = &ChaseMapState{
			CopPosition:    copPos,
			RobberPosition: robberPos,
			Distance:       robberPos - copPos,
			MapLength:      r.chaseMapLen,
			ItemPositions:  visibleItems,
		}
	}

	return payload
}

func (r *Room) UpdateProgress(userID int, prog *GameProgressPayload) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.Players[userID]
	if !ok || p.Finished || p.Eliminated {
		return
	}

	mode := r.Settings.Mode

	// Chase mode: convert text progress to map position
	if mode == ModeChase {
		p.WPM = prog.WPM
		p.Accuracy = prog.Accuracy
		// Calculate move distance with item effects
		move := 1
		if time.Now().Before(p.SpeedBoostEnd) {
			move = 2 // speed boost: double movement
		}
		if time.Now().Before(p.SlowEnd) {
			move = 0 // slowed: no movement
		}
		if p.Role == "robber" {
			// Check if cop used slow trap on robber
			if cop, ok := r.Players[r.chaseCopID]; ok && time.Now().Before(cop.SlowEnd) {
				// Cop's active slow trap on robber not applied here
				// The slow effect on robber is tracked via robber's SlowEnd
			}
		}

		prev := p.Progress
		if p.Role == "cop" {
			newPos := prev + move
			if newPos > p.Progress {
				p.Progress = newPos
			}
		} else {
			newPos := prev + move
			if newPos > p.Progress {
				p.Progress = newPos
			}
		}

		// Check item pickup
		for i, ip := range r.chaseItems {
			if ip.Collected {
				continue
			}
			if p.Progress >= ip.Position && prev < ip.Position {
				r.chaseItems[i].Collected = true
				p.Items = append(p.Items, ip.Item)
				// Broadcast item pickup
				r.broadcastExcept(userID, MsgItemPickup, map[string]interface{}{
					"userId":   userID,
					"position": ip.Position,
				})
				r.Players[userID].Client.Send(MsgItemPickup, map[string]interface{}{
					"userId":   userID,
					"item":     ip.Item,
					"position": ip.Position,
				})
			}
		}

		if p.Progress < 0 {
			p.Progress = 0
		}
		return
	}

	p.Progress = prog.Position
	p.WPM = prog.WPM
	p.Accuracy = prog.Accuracy
	p.Finished = prog.Finished
	if prog.Finished {
		p.FinishedAt = time.Now()
	}

	// Mode-specific end conditions
	switch mode {
	case ModeRace, ModeAccuracy:
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
	case ModeMarathon:
		// Marathon never ends via finish; manual or 24h timeout
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
		select {
		case r.stopTicker <- struct{}{}:
		default:
		}
	}
	r.mu.Unlock()

	results, teamScores, chaseResult := r.collectResults()
	payload := GameResultPayload{
		Results:    results,
		TeamScores: teamScores,
		ChaseResult: chaseResult,
	}
	r.Broadcast(MsgGameResult, payload)
}

func (r *Room) collectResults() ([]PlayerResult, []TeamScore, *ChaseResult) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	mode := r.Settings.Mode
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

	// Mode-specific sorting
	switch mode {
	case ModeAccuracy:
		sort.Slice(results, func(i, j int) bool {
			if results[j].Accuracy != results[i].Accuracy {
				return results[j].Accuracy < results[i].Accuracy
			}
			return results[j].WPM < results[i].WPM
		})
	case ModeElimination:
		aliveFirst := make([]PlayerResult, 0)
		eliminated := make([]PlayerResult, 0)
		for _, r := range results {
			if r.Eliminated {
				eliminated = append(eliminated, r)
			} else {
				aliveFirst = append(aliveFirst, r)
			}
		}
		results = append(aliveFirst, eliminated...)
	case ModeChase:
		sort.Slice(results, func(i, j int) bool {
			return results[j].Progress < results[i].Progress
		})
	default:
		sort.Slice(results, func(i, j int) bool {
			return results[j].WPM < results[i].WPM
		})
	}
	// Assign positions
	for i := range results {
		results[i].Position = i + 1
	}

	// Team scores for team battle
	var teamScores []TeamScore
	if mode == ModeTeamBattle {
		teamMap := make(map[string]struct {
			totalWPM  float64
			totalAcc  float64
			count     int
		})
		for _, r := range results {
			if r.Team == "" { continue }
			entry := teamMap[r.Team]
			entry.totalWPM += r.WPM
			entry.totalAcc += r.Accuracy
			entry.count++
			teamMap[r.Team] = entry
		}
		for team, data := range teamMap {
			if data.count == 0 { continue }
			teamScores = append(teamScores, TeamScore{
				Team:     team,
				AvgWPM:   math.Round(data.totalWPM/float64(data.count)*100) / 100,
				AvgAcc:   math.Round(data.totalAcc/float64(data.count)*100) / 100,
				TotalWPM: math.Round(data.totalWPM*100) / 100,
			})
		}
		sort.Slice(teamScores, func(i, j int) bool {
			return teamScores[j].AvgWPM < teamScores[i].AvgWPM
		})
	}

	// Chase result
	var chaseResult *ChaseResult
	if mode == ModeChase {
		var copPlayer, robberPlayer *PlayerState
		var copID, robberID int
		for _, id := range r.PlayerIdx {
			p := r.Players[id]
			if p.Role == "cop" {
				copPlayer = p
				copID = id
			} else {
				robberPlayer = p
				robberID = id
			}
		}
		if copPlayer != nil && robberPlayer != nil {
			if copPlayer.Progress >= robberPlayer.Progress {
				chaseResult = &ChaseResult{
					WinnerRole: "cop",
					WinnerID:   copID,
					Reason:     "caught",
				}
			} else if robberPlayer.Progress >= r.chaseMapLen {
				chaseResult = &ChaseResult{
					WinnerRole: "robber",
					WinnerID:   robberID,
					Reason:     "escaped",
				}
			} else {
				chaseResult = &ChaseResult{
					WinnerRole: "robber",
					WinnerID:   robberID,
					Reason:     "timeout",
				}
			}
		}
	}

	return results, teamScores, chaseResult
}

func (r *Room) doChaseTick() bool {
	cop := r.Players[r.chaseCopID]
	robber := r.Players[r.chaseRobberID]
	if cop == nil || robber == nil {
		return false
	}

	// Check if cop caught robber
	if cop.Progress >= robber.Progress {
		return true
	}

	// Check if robber reached the end
	if robber.Progress >= r.chaseMapLen {
		return true
	}
	return false
}

// --- AI Player simulation ---

func (r *Room) startAIPlayers() {
	if !r.Settings.AIEnabled || r.Settings.AICount <= 0 {
		return
	}

	r.mu.Lock()
	r.aiDone = make(chan struct{})
	aiCount := r.Settings.AICount
	textLen := len(r.Text)
	mode := r.Settings.Mode
	r.mu.Unlock()

	for i := 0; i < aiCount; i++ {
		aiID := -2 - i
		aiClient := &Client{
			conn:     nil,
			UserID:   aiID,
			Username: fmt.Sprintf("Bot-%d", i+1),
			Role:     "ai",
		}

		r.mu.Lock()
		// Assign team/role like a real player
		team := ""
		role := ""
		if mode == ModeTeamBattle {
			team = []string{"red", "blue"}[i%2]
		}
		if mode == ModeChase {
			if r.chaseCopID == 0 {
				role = "cop"
				r.chaseCopID = aiID
			} else {
				role = "robber"
				r.chaseRobberID = aiID
			}
		}
		r.Players[aiID] = &PlayerState{
			Client: aiClient,
			Ready:  true,
			Team:   team,
			Role:   role,
		}
		r.PlayerIdx = append(r.PlayerIdx, aiID)
		r.mu.Unlock()

		// Update lobby so clients see AI players
		r.Broadcast(MsgRoomUpdate, r.GetRoomInfo())

		// Target WPM scales with AI count: more bots = harder
		targetWPM := 30 + float64(aiCount)*12
		if targetWPM > 130 {
			targetWPM = 130
		}
		targetWPM += float64(i) * 5 // later bots are slightly faster

		// Per-character delay based on target WPM
		charDelay := time.Duration(float64(time.Minute) / (targetWPM * 5))

		go r.runAIPlayer(aiID, textLen, charDelay, targetWPM)
	}
}

func (r *Room) runAIPlayer(aiID int, textLen int, baseDelay time.Duration, targetWPM float64) {
	// Reaction delay: 0.5-2s
	rng := rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64()))
	reaction := time.Duration(500+rng.IntN(1500)) * time.Millisecond
	time.Sleep(reaction)

	pos := 0
	errorRate := 0.08 + rng.Float64()*0.04 // 8-12% error rate
	delayJitter := 0.7                      // ±30% jitter

	for {
		r.mu.RLock()
		if r.Status != StatusPlaying {
			r.mu.RUnlock()
			return
		}
		r.mu.RUnlock()

		if pos >= textLen {
			break
		}

		// Simulate a burst of 1-5 chars
		burst := 1 + rng.IntN(4)
		step := 0
		for j := 0; j < burst && pos < textLen; j++ {
			pos++
			step++
		}

		// Simulate errors: backspace the last char with some probability
		hadError := false
		if rng.Float64() < errorRate && pos > 0 && pos < textLen {
			// "Backspace" - undo one char
			pos--
			time.Sleep(time.Duration(100+rng.IntN(300)) * time.Millisecond)
			hadError = true
		}

		accuracy := 100.0
		if hadError {
			accuracy = 90.0 + rng.Float64()*8.0 // ~92-98% with error
		}

		elapsed := time.Since(r.StartTime).Milliseconds()
		wpm := targetWPM * (0.8 + rng.Float64()*0.4) // vary ±20%

		r.UpdateProgress(aiID, &GameProgressPayload{
			Position: pos,
			WPM:      wpm,
			Accuracy: accuracy,
			Finished: pos >= textLen,
		})

		if pos >= textLen {
			return
		}

		// Delay between bursts with jitter
		jitter := time.Duration(float64(baseDelay) * delayJitter * float64(step))
		variance := time.Duration(float64(jitter) * (0.7 + rng.Float64()*0.6))
		_ = elapsed // used via WPM calc
		time.Sleep(variance)
	}
}

func (r *Room) stopAIPlayers() {
	// AI goroutines check r.Status, so they exit naturally when game ends.
	// No explicit stop needed, but signal cleanup.
}

func (r *Room) UseItem(userID int, item ItemType) {
	r.mu.Lock()
	defer r.mu.Unlock()

	def, ok := GetItemDef(item)
	if !ok {
		return
	}

	p, ok := r.Players[userID]
	if !ok || r.Settings.Mode != ModeChase {
		return
	}

	found := -1
	for i, it := range p.Items {
		if it == item {
			found = i
			break
		}
	}
	if found < 0 {
		return
	}
	p.Items = append(p.Items[:found], p.Items[found+1:]...)
	r.Players[userID] = p

	handler, ok := effectHandlers[def.EffectType]
	if !ok {
		return
	}

	targetID := getOpponentID(r, userID)
	handler(r, userID, targetID, def)

	r.Broadcast(MsgRoomUpdate, r.GetRoomInfo())
}

func generateChaseItems(mapLen int) []ItemPos {
	allDefs := GetAllItemDefs()
	if len(allDefs) == 0 {
		return nil
	}

	positions := make([]ItemPos, 0)
	used := make(map[int]bool)

	for i := 0; i < 6; i++ {
		pos := 15 + i*(mapLen-15)/6 + (mapLen/30)*(i%3-1)
		if pos < 15 {
			pos = 15
		}
		if pos >= mapLen {
			pos = mapLen - 5
		}
		if used[pos] {
			continue
		}
		used[pos] = true
		positions = append(positions, ItemPos{
			Position: pos,
			Item:     allDefs[i%len(allDefs)].ID,
		})
	}
	return positions
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
	// Clear chase & elimination state
	r.chaseCopID = 0
	r.chaseRobberID = 0
	r.chaseMapLen = 0
	r.chaseItems = nil
	// Remove AI players
	aiIDs := make([]int, 0)
	for _, id := range r.PlayerIdx {
		if id < 0 {
			aiIDs = append(aiIDs, id)
		}
	}
	for _, id := range aiIDs {
		delete(r.Players, id)
	}
	newIdx := make([]int, 0, len(r.PlayerIdx))
	for _, id := range r.PlayerIdx {
		if id >= 0 {
			newIdx = append(newIdx, id)
		}
	}
	r.PlayerIdx = newIdx
	// Reset remaining player state
	for _, p := range r.Players {
		p.Items = nil
		p.SpeedBoostEnd = time.Time{}
		p.SlowEnd = time.Time{}
		p.HasShield = false
		p.StartPos = 0
	}
	r.Status = StatusWaiting
	r.Text = ""

	r.Broadcast(MsgRoomUpdate, r.GetRoomInfo())
}

var builtinWords = []string{
	"the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
	"pack", "my", "box", "with", "five", "dozen", "liquor", "jugs",
	"how", "vexingly", "daft", "zebras", "jump", "boxing", "wizards",
	"sphinx", "black", "quartz", "judge", "vow", "river", "bank",
	"testing", "purpose", "word", "speed", "typing", "practice",
	"keyboard", "letter", "character", "sentence", "text", "game",
	"score", "high", "level", "time", "minute", "second", "fast",
	"slow", "accuracy", "cryptic", "gazebo", "jovial", "mystify",
	"pickled", "sprite", "trombone", "unicorn", "vortex", "waltz",
	"blitz", "dwarves", "fjord", "gypsy", "haiku", "jazz", "kayak",
	"luxury", "nymph", "photo", "sphinx", "swivel", "topaz", "zephyr",
}

var builtinModeWordCount = map[GameMode]int{
	ModeAccuracy:    15,
	ModeChase:       60,
	ModeMarathon:    10,
	ModeTimeBattle:  50,
	ModeElimination: 35,
}

func generateGameText(settings RoomSettings) string {
	n, ok := builtinModeWordCount[settings.Mode]
	if !ok {
		n = 40
	}
	words := make([]string, n)
	for i := range words {
		words[i] = builtinWords[rand.IntN(len(builtinWords))]
	}
	s := strings.Join(words, " ")
	if settings.Mode == ModeAccuracy {
		if len(s) > 0 {
			s = strings.ToUpper(s[:1]) + s[1:] + "."
		}
	}
	return s
}


