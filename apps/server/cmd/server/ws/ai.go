package ws

import (
	"fmt"
	"math/rand/v2"
	"time"
)

type aiDifficultyConfig struct {
	baseWPM     float64
	wpmVariance float64
	errorRate   [2]float64
	reactionMin int
	reactionMax int
	burstMin    int
	burstMax    int
}

var aiDifficultyConfigs = map[AIDifficulty]aiDifficultyConfig{
	AIDifficultyEasy:   {baseWPM: 25, wpmVariance: 0.3, errorRate: [2]float64{0.15, 0.25}, reactionMin: 800, reactionMax: 2500, burstMin: 1, burstMax: 2},
	AIDifficultyMedium: {baseWPM: 50, wpmVariance: 0.2, errorRate: [2]float64{0.08, 0.15}, reactionMin: 500, reactionMax: 1500, burstMin: 2, burstMax: 4},
	AIDifficultyHard:   {baseWPM: 85, wpmVariance: 0.15, errorRate: [2]float64{0.03, 0.08}, reactionMin: 200, reactionMax: 800, burstMin: 3, burstMax: 6},
}

func getAIConfig(diff AIDifficulty) aiDifficultyConfig {
	if cfg, ok := aiDifficultyConfigs[diff]; ok {
		return cfg
	}
	return aiDifficultyConfigs[AIDifficultyMedium]
}

func (r *Room) startAIPlayers() {
	if !r.Settings.AIEnabled || r.Settings.AICount <= 0 {
		return
	}

	r.mu.Lock()
	r.aiDone = make(chan struct{})
	aiCount := r.Settings.AICount
	textLen := len(r.Text)
	mode := r.Settings.Mode
	diff := r.Settings.AIDifficulty
	if diff == "" {
		diff = AIDifficultyMedium
	}
	cfg := getAIConfig(diff)
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

		r.Broadcast(MsgRoomUpdate, r.GetRoomInfo())

		botWPM := cfg.baseWPM + float64(i)*5
		charDelay := time.Duration(float64(time.Minute) / (botWPM * 5))

		go r.runAIPlayer(aiID, textLen, charDelay, cfg)
	}
}

func (r *Room) runAIPlayer(aiID int, textLen int, baseDelay time.Duration, cfg aiDifficultyConfig) {
	rng := rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64()))
	reaction := time.Duration(cfg.reactionMin+rng.IntN(cfg.reactionMax-cfg.reactionMin+1)) * time.Millisecond
	time.Sleep(reaction)

	pos := 0

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

		burst := cfg.burstMin + rng.IntN(cfg.burstMax-cfg.burstMin+1)
		step := 0
		for j := 0; j < burst && pos < textLen; j++ {
			pos++
			step++
		}

		actualErrorRate := cfg.errorRate[0] + rng.Float64()*(cfg.errorRate[1]-cfg.errorRate[0])
		hadError := false
		if rng.Float64() < actualErrorRate && pos > 0 && pos < textLen {
			pos--
			time.Sleep(time.Duration(100+rng.IntN(300)) * time.Millisecond)
			hadError = true
		}

		accuracy := 100.0
		if hadError {
			accuracy = 90.0 + rng.Float64()*8.0
		}

		wpm := cfg.baseWPM * (1.0 - cfg.wpmVariance + rng.Float64()*2*cfg.wpmVariance)

		r.UpdateProgress(aiID, &GameProgressPayload{
			Position: pos,
			WPM:      wpm,
			Accuracy: accuracy,
			Finished: pos >= textLen,
		})

		if pos >= textLen {
			return
		}

		jitter := time.Duration(float64(baseDelay) * 0.7 * float64(step))
		variance := time.Duration(float64(jitter) * (0.7 + rng.Float64()*0.6))
		time.Sleep(variance)
	}
}
