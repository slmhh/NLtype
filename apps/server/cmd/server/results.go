package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
	Username   string `json:"username"`
	WPM        int    `json:"wpm"`
	Accuracy   int    `json:"accuracy"`
	ModeLabel  string `json:"modeLabel"`
	LangLabel  string `json:"langLabel"`
	Date       string `json:"date"`
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
		return "�?
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
	limitBody(r)
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	type TypingEvent struct {
		CharIndex    int    `json:"charIndex"`
		ExpectedChar string `json:"expectedChar"`
		TypedChar    string `json:"typedChar"`
		LatencyMs    int    `json:"latencyMs"`
		ElapsedMs    int    `json:"elapsedMs"`
	}

	var body struct {
		Mode           string        `json:"mode"`
		Language       string        `json:"language"`
		WPM            int           `json:"wpm"`
		Accuracy       int           `json:"accuracy"`
		CPM            int           `json:"cpm"`
		RawWPM         int           `json:"rawWpm"`
		CorrectCount   int           `json:"correctCount"`
		IncorrectCount int           `json:"incorrectCount"`
		DurationSec    int           `json:"durationSec"`
		Events         []TypingEvent `json:"events,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	validModes := map[string]bool{"time": true, "words": true, "quote": true, "code": true, "zen": true, "custom": true}
	validLangs := map[string]bool{"en": true, "zh": true, "code": true}

	if !validModes[body.Mode] {
		writeError(w, 400, "Invalid mode")
		return
	}
	if !validLangs[body.Language] {
		writeError(w, 400, "Invalid language")
		return
	}
	if body.WPM < 0 || body.WPM > 500 {
		writeError(w, 400, "Invalid WPM (0-500)")
		return
	}
	if body.Accuracy < 0 || body.Accuracy > 100 {
		writeError(w, 400, "Invalid accuracy (0-100)")
		return
	}
	if body.CPM < 0 || body.CPM > 5000 {
		writeError(w, 400, "Invalid CPM")
		return
	}
	if body.RawWPM < 0 || body.RawWPM > 500 {
		writeError(w, 400, "Invalid raw WPM")
		return
	}
	if body.CorrectCount <= 0 || body.CorrectCount > 5000 {
		writeError(w, 400, "Invalid correct count")
		return
	}
	if body.IncorrectCount < 0 || body.IncorrectCount > 5000 {
		writeError(w, 400, "Invalid incorrect count")
		return
	}
	if body.DurationSec <= 0 || body.DurationSec > 3600 {
		writeError(w, 400, "Invalid duration (1-3600 seconds)")
		return
	}

	// Limit events to prevent abuse
	if len(body.Events) > 10000 {
		body.Events = body.Events[:10000]
	}

	tx, err := db.Begin()
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}
	defer tx.Rollback()

	created := nowISO()
	var id int
	err = tx.QueryRow(
		`INSERT INTO results (user_id, username, mode, language, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		claims.ID, claims.Username, body.Mode, body.Language,
		body.WPM, body.Accuracy, body.CPM, body.RawWPM,
		body.CorrectCount, body.IncorrectCount, body.DurationSec, created,
	).Scan(&id)
	if err != nil {
		writeError(w, 500, "Failed to save result")
		return
	}

	// Save typing events within the same transaction
	if len(body.Events) > 0 {
		stmt, err := tx.Prepare(
			`INSERT INTO typing_events (result_id, char_index, expected_char, typed_char, latency_ms, is_correct, elapsed_ms)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			writeError(w, 500, "Failed to prepare event insert")
			return
		}
		defer stmt.Close()
		for _, e := range body.Events {
			isCorrect := 0
			if e.ExpectedChar == e.TypedChar {
				isCorrect = 1
			}
			if _, err := stmt.Exec(id, e.CharIndex, e.ExpectedChar, e.TypedChar, e.LatencyMs, isCorrect, e.ElapsedMs); err != nil {
				log.Printf("insert event: %v", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, 500, "Failed to save result")
		return
	}

	res := GameResult{
		ID:             id,
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
		CreatedAt:      created,
	}

	writeJSON(w, 201, map[string]any{"result": res})
}

func handleGetResults(w http.ResponseWriter, r *http.Request) {
	limitBody(r)
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	rows, err := db.Query(
		`SELECT id, user_id, username, mode, language, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at
		 FROM results WHERE user_id = ? ORDER BY id DESC`, claims.ID)
	if err != nil {
		writeError(w, 500, "Failed to fetch results")
		return
	}
	defer rows.Close()

	var userResults []GameResult
	for rows.Next() {
		var r GameResult
		if err := rows.Scan(&r.ID, &r.UserID, &r.Username, &r.Mode, &r.Language,
			&r.WPM, &r.Accuracy, &r.CPM, &r.RawWPM, &r.CorrectCount, &r.IncorrectCount, &r.DurationSec, &r.CreatedAt); err != nil {
			log.Printf("scan result row: %v", err)
			continue
		}
		userResults = append(userResults, r)
	}
	if userResults == nil {
		userResults = []GameResult{}
	}
	writeJSON(w, 200, map[string]any{"results": userResults})
}

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	where := ""
	args := []any{}
	if after := r.URL.Query().Get("after"); after != "" {
		where += " AND created_at >= ?"
		args = append(args, after)
	}
	if before := r.URL.Query().Get("before"); before != "" {
		where += " AND created_at <= ?"
		args = append(args, before)
	}
	args = append(args, limit)

	rows, err := db.Query(
		`SELECT username, wpm, accuracy, mode, language, created_at
		 FROM results WHERE 1=1`+where+` ORDER BY wpm DESC LIMIT ?`, args...)
	if err != nil {
		writeError(w, 500, "Failed to fetch leaderboard")
		return
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	rank := 1
	for rows.Next() {
		var username, mode, lang, createdAt string
		var wpm, accuracy int
		if err := rows.Scan(&username, &wpm, &accuracy, &mode, &lang, &createdAt); err != nil {
			log.Printf("scan leaderboard row: %v", err)
			continue
		}
		entries = append(entries, LeaderboardEntry{
			Rank:      rank,
			Username:  username,
			WPM:       wpm,
			Accuracy:  accuracy,
			ModeLabel: modeLabel(mode),
			LangLabel: langLabel(lang),
			Date:      createdAt[:10],
		})
		rank++
	}
	if entries == nil {
		entries = []LeaderboardEntry{}
	}
	writeJSON(w, 200, map[string]any{"entries": entries})
}

type PersonalBest struct {
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

func handlePersonalBests(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	rows, err := db.Query(
		`SELECT mode, language, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at
		 FROM (
		   SELECT *, ROW_NUMBER() OVER (PARTITION BY mode, language ORDER BY wpm DESC) as rn
		   FROM results WHERE user_id = ?
		 ) ranked WHERE rn = 1 ORDER BY wpm DESC`, claims.ID)
	if err != nil {
		writeError(w, 500, "Failed to fetch personal bests")
		return
	}
	defer rows.Close()

	var bests []PersonalBest
	for rows.Next() {
		var b PersonalBest
		if err := rows.Scan(&b.Mode, &b.Language, &b.WPM, &b.Accuracy, &b.CPM, &b.RawWPM,
			&b.CorrectCount, &b.IncorrectCount, &b.DurationSec, &b.CreatedAt); err != nil {
			log.Printf("scan personal best row: %v", err)
			continue
		}
		bests = append(bests, b)
	}
	if bests == nil {
		bests = []PersonalBest{}
	}
	writeJSON(w, 200, map[string]any{"bests": bests})
}

type ResultStats struct {
	TotalEvents    int                `json:"totalEvents"`
	AvgLatencyMs   int                `json:"avgLatencyMs"`
	MaxLatencyMs   int                `json:"maxLatencyMs"`
	LatencyBuckets []LatencyBucket    `json:"latencyBuckets"`
	ErrorMap       map[string]int     `json:"errorMap"`
	KeyFrequency   map[string]int     `json:"keyFrequency"`
}

type LatencyBucket struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

func handleResultStats(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	resultID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, 400, "Invalid result ID")
		return
	}

	// Verify ownership
	var ownerID int
	err = db.QueryRow("SELECT user_id FROM results WHERE id = ?", resultID).Scan(&ownerID)
	if err != nil {
		writeError(w, 404, "Result not found")
		return
	}
	if ownerID != claims.ID && !hasPermission(Role(claims.Role), "admin:panel") {
		writeError(w, 403, "Access denied")
		return
	}

	rows, err := db.Query(
		`SELECT char_index, expected_char, typed_char, latency_ms, is_correct, elapsed_ms
		 FROM typing_events WHERE result_id = ? ORDER BY char_index`, resultID)
	if err != nil {
		writeJSON(w, 200, map[string]any{"stats": nil, "events": []any{}})
		return
	}
	defer rows.Close()

	var events []map[string]any
	var totalLatency, maxLatency, total int
	buckets := map[string]int{
		"0-100": 0, "100-200": 0, "200-300": 0, "300-400": 0,
		"400-500": 0, "500-750": 0, "750-1000": 0, "1000+": 0,
	}
	errorMap := make(map[string]int)
	keyFreq := make(map[string]int)

	for rows.Next() {
		var ci, latMs, correct, elapsed int
		var exp, typed string
		if err := rows.Scan(&ci, &exp, &typed, &latMs, &correct, &elapsed); err != nil {
			continue
		}
		total++
		totalLatency += latMs
		if latMs > maxLatency {
			maxLatency = latMs
		}
		keyFreq[exp]++

		switch {
		case latMs <= 100:
			buckets["0-100"]++
		case latMs <= 200:
			buckets["100-200"]++
		case latMs <= 300:
			buckets["200-300"]++
		case latMs <= 400:
			buckets["300-400"]++
		case latMs <= 500:
			buckets["400-500"]++
		case latMs <= 750:
			buckets["500-750"]++
		case latMs <= 1000:
			buckets["750-1000"]++
		default:
			buckets["1000+"]++
		}

		if correct == 0 {
			errorMap[fmt.Sprintf("%s�?s", exp, typed)]++
		}

		events = append(events, map[string]any{
			"charIndex":    ci,
			"expectedChar": exp,
			"typedChar":    typed,
			"latencyMs":    latMs,
			"isCorrect":    correct == 1,
			"elapsedMs":    elapsed,
		})
	}

	avgLatency := 0
	if total > 0 {
		avgLatency = totalLatency / total
	}

	var latencyBuckets []LatencyBucket
	for _, label := range []string{"0-100", "100-200", "200-300", "300-400", "400-500", "500-750", "750-1000", "1000+"} {
		latencyBuckets = append(latencyBuckets, LatencyBucket{Label: label, Count: buckets[label]})
	}

	stats := ResultStats{
		TotalEvents:    total,
		AvgLatencyMs:   avgLatency,
		MaxLatencyMs:   maxLatency,
		LatencyBuckets: latencyBuckets,
		ErrorMap:       errorMap,
		KeyFrequency:   keyFreq,
	}

	writeJSON(w, 200, map[string]any{"stats": stats, "events": events})
}

func handleClearResults(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "admin:panel") {
		writeError(w, 403, "Insufficient permissions")
		return
	}
	db.Exec("DELETE FROM results")
	writeJSON(w, 200, map[string]any{"ok": true})
}
