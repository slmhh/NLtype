package ws

import (
	"math"
	"sort"
	"time"
)

func (r *Room) StartGame() {
	r.mu.Lock()
	if r.Status != StatusWaiting {
		r.mu.Unlock()
		return
	}
	r.Status = StatusCountdown
	r.Text = generateGameText(r.Settings)
	r.mu.Unlock()

	for i := 3; i > 0; i-- {
		r.Broadcast(MsgGameCountdown, map[string]int{"count": i})
		time.Sleep(1 * time.Second)
	}
	r.Broadcast(MsgGameCountdown, map[string]int{"count": 0})

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
				p.Progress = 20
			}
		}
	}
	r.mu.Unlock()

	r.Broadcast(MsgGameStart, map[string]interface{}{
		"text":     r.Text,
		"mode":     r.Settings.Mode,
		"duration": r.Duration,
	})

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

	r.Broadcast(MsgGameSync, r.getSyncPayload())

	r.mu.Lock()
	defer r.mu.Unlock()

	if mode == ModeElimination {
		r.elimTick++
		if r.elimTick >= 150 && len(r.PlayerIdx) > 1 {
			r.elimTick = 0
			r.doEliminationTick()
		}
	}

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

	if r.Settings.Mode == ModeChase {
		copPos := 0
		robberPos := 20
		if cp, ok := r.Players[r.chaseCopID]; ok {
			copPos = cp.Progress
		}
		if rp, ok := r.Players[r.chaseRobberID]; ok {
			robberPos = rp.Progress
		}
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

	if mode == ModeChase {
		p.WPM = prog.WPM
		p.Accuracy = prog.Accuracy
		move := 1
		if time.Now().Before(p.SpeedBoostEnd) {
			move = 2
		}
		if time.Now().Before(p.SlowEnd) {
			move = 0
		}

		prev := p.Progress
		newPos := prev + move
		if newPos > p.Progress {
			p.Progress = newPos
		}

		for i, ip := range r.chaseItems {
			if ip.Collected {
				continue
			}
			if p.Progress >= ip.Position && prev < ip.Position {
				r.chaseItems[i].Collected = true
				p.Items = append(p.Items, ip.Item)
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
	}
}

func (r *Room) doEliminationTick() {
	if len(r.PlayerIdx) <= 1 {
		return
	}

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
			"userId": lowestID,
			"reason": "lowest_wpm",
		})
	}

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
		Results:     results,
		TeamScores:  teamScores,
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
		for _, res := range results {
			if res.Eliminated {
				eliminated = append(eliminated, res)
			} else {
				aliveFirst = append(aliveFirst, res)
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
	for i := range results {
		results[i].Position = i + 1
	}

	var teamScores []TeamScore
	if mode == ModeTeamBattle {
		teamMap := make(map[string]struct {
			totalWPM float64
			totalAcc float64
			count    int
		})
		for _, res := range results {
			if res.Team == "" {
				continue
			}
			entry := teamMap[res.Team]
			entry.totalWPM += res.WPM
			entry.totalAcc += res.Accuracy
			entry.count++
			teamMap[res.Team] = entry
		}
		for team, data := range teamMap {
			if data.count == 0 {
				continue
			}
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
				chaseResult = &ChaseResult{WinnerRole: "cop", WinnerID: copID, Reason: "caught"}
			} else if robberPlayer.Progress >= r.chaseMapLen {
				chaseResult = &ChaseResult{WinnerRole: "robber", WinnerID: robberID, Reason: "escaped"}
			} else {
				chaseResult = &ChaseResult{WinnerRole: "robber", WinnerID: robberID, Reason: "timeout"}
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
	if cop.Progress >= robber.Progress {
		return true
	}
	if robber.Progress >= r.chaseMapLen {
		return true
	}
	return false
}

func (r *Room) Rematch(userID int) {
	r.mu.Lock()
	defer r.mu.Unlock()

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
	r.chaseCopID = 0
	r.chaseRobberID = 0
	r.chaseMapLen = 0
	r.chaseItems = nil

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

	for _, p := range r.Players {
		p.Items = nil
		p.SpeedBoostEnd = time.Time{}
		p.SlowEnd = time.Time{}
		p.HasShield = false
		p.StartPos = 0
	}
	r.Status = StatusWaiting
	r.Text = ""
	r.aiNextID = -2

	r.Broadcast(MsgRoomUpdate, r.GetRoomInfo())
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
