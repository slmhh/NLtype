package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
)

type GameResult struct {
	ID             int    `json:"id"`
	UserID         int    `json:"userId"`
	Username       string `json:"username"`
	Mode           string `json:"mode"`
	Language       string `json:"language"`
	WPM            int    `json:"wpm"`
	Accuracy       int    `json:"accuracy"`
	CPM            int    `json:"cpm"`
	RawWPM         int    `json:"rawWpm"`
	CorrectCount   int    `json:"correctCount"`
	IncorrectCount int    `json:"incorrectCount"`
	DurationSec    int    `json:"durationSec"`
	CreatedAt      string `json:"createdAt"`
}

type LeaderboardEntry struct {
	Rank       int    `json:"rank"`
	WPM        int    `json:"wpm"`
	Accuracy   int    `json:"accuracy"`
	ModeLabel  string `json:"modeLabel"`
	LangLabel  string `json:"langLabel"`
	Date       string `json:"date"`
	Username   string `json:"username"`
}

var results []GameResult
var nextResultID = 1
var resultsPath string

func loadResults() {
	resultsPath = filepath.Join(dataDir, "results.json")
	readJSON(resultsPath, &results)
	for _, r := range results {
		if r.ID >= nextResultID {
			nextResultID = r.ID + 1
		}
	}
}

func saveResults() {
	writeJSONFile(resultsPath, results)
}

func modeLabel(m string) string {
	switch m {
	case "time":
		return "计时"
	case "words":
		return "单词"
	case "quote":
		return "引用"
	case "code":
		return "代码"
	case "zen":
		return "禅"
	}
	return m
}

func langLabel(l string) string {
	switch l {
	case "en":
		return "EN"
	case "zh":
		return "ZH"
	case "code":
		return "Code"
	}
	return l
}

// ── Handlers ──

func handleCreateResult(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	var body struct {
		Mode           string `json:"mode"`
		Language       string `json:"language"`
		WPM            int    `json:"wpm"`
		Accuracy       int    `json:"accuracy"`
		CPM            int    `json:"cpm"`
		RawWPM         int    `json:"rawWpm"`
		CorrectCount   int    `json:"correctCount"`
		IncorrectCount int    `json:"incorrectCount"`
		DurationSec    int    `json:"durationSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if body.Mode == "" || body.WPM == 0 {
		writeError(w, 400, "Missing required fields")
		return
	}

	res := GameResult{
		ID:             nextResultID,
		UserID:         claims.ID,
		Username:       claims.Username,
		Mode:           body.Mode,
		Language:       body.Language,
		WPM:            body.WPM,
		Accuracy:       body.Accuracy,
		CPM:            body.CPM,
		RawWPM:         body.RawWPM,
		CorrectCount:   body.CorrectCount,
		IncorrectCount: body.IncorrectCount,
		DurationSec:    body.DurationSec,
		CreatedAt:      timeNow(),
	}
	nextResultID++

	results = append([]GameResult{res}, results...)
	saveResults()

	writeJSON(w, 201, map[string]any{"result": res})
}

func handleGetResults(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	var userResults []GameResult
	for _, res := range results {
		if res.UserID == claims.ID {
			userResults = append(userResults, res)
		}
	}
	if userResults == nil {
		userResults = []GameResult{}
	}
	writeJSON(w, 200, map[string]any{"results": userResults})
}

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	sorted := make([]GameResult, len(results))
	copy(sorted, results)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].WPM > sorted[j].WPM
	})
	if len(sorted) > limit {
		sorted = sorted[:limit]
	}

	entries := make([]LeaderboardEntry, len(sorted))
	for i, r := range sorted {
		entries[i] = LeaderboardEntry{
			Rank:      i + 1,
			WPM:       r.WPM,
			Accuracy:  r.Accuracy,
			ModeLabel: modeLabel(r.Mode),
			LangLabel: langLabel(r.Language),
			Date:      r.CreatedAt[:10],
			Username:  r.Username,
		}
	}
	if entries == nil {
		entries = []LeaderboardEntry{}
	}
	writeJSON(w, 200, map[string]any{"entries": entries})
}

func handleClearResults(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "leaderboard:clear") {
		writeError(w, 403, "Insufficient permissions")
		return
	}
	results = nil
	saveResults()
	writeJSON(w, 200, map[string]any{"ok": true})
}
