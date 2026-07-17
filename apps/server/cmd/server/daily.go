package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"time"
)

var englishPool = []string{
	"the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
	"for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
	"but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
	"an", "will", "my", "one", "all", "would", "there", "their", "what", "so",
	"up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
	"make", "can", "like", "time", "no", "just", "him", "know", "take", "people",
	"into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
	"then", "now", "look", "only", "come", "its", "over", "think", "also", "back",
	"after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
	"new", "want", "because", "any", "these", "give", "day", "most", "us", "great",
	"between", "need", "large", "often", "hand", "high", "place", "small", "under", "long",
	"right", "still", "house", "world", "last", "school", "never", "city", "tree", "cross",
	"farm", "hard", "start", "might", "story", "saw", "far", "sea", "draw", "left",
	"late", "run", "while", "press", "close", "night", "real", "life", "few", "north",
	"open", "seem", "together", "next", "white", "children", "begin", "got", "walk", "example",
	"ease", "paper", "group", "always", "music", "those", "both", "mark", "book", "letter",
	"until", "mile", "river", "car", "feet", "care", "second", "enough", "plain", "girl",
	"usual", "young", "ready", "above", "ever", "red", "list", "though", "feel", "talk",
	"bird", "soon", "body", "dog", "family", "direct", "pose", "leave", "song", "measure",
	"door", "product", "black", "short", "number", "class", "wind", "question", "happen", "complete",
	"ship", "area", "half", "rock", "order", "fire", "south", "problem", "piece", "told",
	"knew", "pass", "farm", "top", "whole", "king", "size", "heard", "best", "hour",
	"better", "true", "during", "hundred", "remember", "step", "early", "hold", "west", "ground",
	"interest", "reach", "fast", "five", "sing", "listen", "six", "table", "travel", "less",
	"morning", "ten", "simple", "several", "vowel", "toward", "war", "lay", "against", "pattern",
	"slow", "center", "love", "person", "money", "serve", "appear", "road", "map", "science",
	"friend", "cold", "notice", "voice", "fall", "power", "town", "fine", "certain", "fly",
	"unit", "lead", "cry", "dark", "machine", "note", "wait", "plan", "figure", "star",
	"box", "noun", "field", "rest", "correct", "able", "pound", "done", "beauty", "drive",
}

func seedForDate(dateStr string) int64 {
	h := sha256.Sum256([]byte("daily:" + dateStr))
	return int64(h[0])<<56 | int64(h[1])<<48 | int64(h[2])<<40 | int64(h[3])<<32 |
		int64(h[4])<<24 | int64(h[5])<<16 | int64(h[6])<<8 | int64(h[7])
}

func generateDailyText(dateStr string) string {
	rng := rand.New(rand.NewSource(seedForDate(dateStr)))
	targetLen := 300
	var words []string
	length := 0
	for length < targetLen {
		w := englishPool[rng.Intn(len(englishPool))]
		words = append(words, w)
		length += len(w) + 1
	}
	return words[:len(words)-1][0 : len(words)-1]
}

func todayStr() string {
	return time.Now().UTC().Format("2006-01-02")
}

func getOrCreateDailyChallenge(dateStr string) (int, string, error) {
	var id int
	var text string
	err := db.QueryRow("SELECT id, text FROM daily_challenges WHERE date = ?", dateStr).Scan(&id, &text)
	if err == nil {
		return id, text, nil
	}

	text = generateDailyText(dateStr)
	now := nowISO()
	result, err := db.Exec("INSERT INTO daily_challenges (date, text, created_at) VALUES (?, ?, ?)", dateStr, text, now)
	if err != nil {
		return 0, "", err
	}
	insertID, _ := result.LastInsertId()
	return int(insertID), text, nil
}

func handleDailyChallenge(w http.ResponseWriter, r *http.Request) {
	dateStr := todayStr()
	id, text, err := getOrCreateDailyChallenge(dateStr)
	if err != nil {
		log.Printf("Failed to get/create daily challenge: %v", err)
		writeError(w, 500, "Failed to load daily challenge")
		return
	}

	// Check if user has already submitted today
	var alreadyDone bool
	claims := getAuthUser(r)
	if claims != nil {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM daily_attempts WHERE user_id = ? AND challenge_id = ?", claims.ID, id).Scan(&count)
		alreadyDone = count > 0
	}

	writeJSON(w, 200, map[string]any{
		"challengeId": id,
		"date":        dateStr,
		"text":        text,
		"alreadyDone": alreadyDone,
	})
}

func handleSubmitDailyAttempt(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	var body struct {
		ChallengeID    int `json:"challengeId"`
		WPM            int `json:"wpm"`
		Accuracy       int `json:"accuracy"`
		CPM            int `json:"cpm"`
		RawWPM         int `json:"rawWpm"`
		CorrectCount   int `json:"correctCount"`
		IncorrectCount int `json:"incorrectCount"`
		DurationSec    int `json:"durationSec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}

	// Validate fields
	if body.WPM < 0 || body.WPM > 500 {
		writeError(w, 400, "Invalid WPM")
		return
	}
	if body.Accuracy < 0 || body.Accuracy > 100 {
		writeError(w, 400, "Invalid accuracy")
		return
	}
	if body.DurationSec <= 0 || body.DurationSec > 3600 {
		writeError(w, 400, "Invalid duration")
		return
	}

	// Check challenge exists and belongs to today
	dateStr := todayStr()
	var challengeID int
	err := db.QueryRow("SELECT id FROM daily_challenges WHERE id = ? AND date = ?", body.ChallengeID, dateStr).Scan(&challengeID)
	if err != nil {
		writeError(w, 400, "Invalid or expired challenge")
		return
	}

	// Check not already submitted
	var existing int
	db.QueryRow("SELECT COUNT(*) FROM daily_attempts WHERE user_id = ? AND challenge_id = ?", claims.ID, challengeID).Scan(&existing)
	if existing > 0 {
		writeError(w, 409, "Already submitted today")
		return
	}

	now := nowISO()
	_, err = db.Exec(
		`INSERT INTO daily_attempts (user_id, challenge_id, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		claims.ID, challengeID, body.WPM, body.Accuracy, body.CPM, body.RawWPM,
		body.CorrectCount, body.IncorrectCount, body.DurationSec, now)
	if err != nil {
		log.Printf("Failed to save daily attempt: %v", err)
		writeError(w, 500, "Failed to save attempt")
		return
	}

	writeJSON(w, 201, map[string]any{"success": true})
}

func handleDailyLeaderboard(w http.ResponseWriter, r *http.Request) {
	dateStr := todayStr()
	rows, err := db.Query(
		`SELECT a.wpm, a.accuracy, a.cpm, a.correct_count, a.incorrect_count, a.duration_sec, a.created_at, u.username
		 FROM daily_attempts a
		 JOIN users u ON u.id = a.user_id
		 JOIN daily_challenges c ON c.id = a.challenge_id
		 WHERE c.date = ?
		 ORDER BY a.wpm DESC, a.accuracy DESC, a.duration_sec ASC`, dateStr)
	if err != nil {
		writeJSON(w, 200, map[string]any{"entries": []any{}})
		return
	}
	defer rows.Close()

	type Entry struct {
		Rank           int    `json:"rank"`
		Username       string `json:"username"`
		WPM            int    `json:"wpm"`
		Accuracy       int    `json:"accuracy"`
		CPM            int    `json:"cpm"`
		CorrectCount   int    `json:"correctCount"`
		IncorrectCount int    `json:"incorrectCount"`
		DurationSec    int    `json:"durationSec"`
		Date           string `json:"date"`
	}

	var entries []Entry
	rank := 0
	for rows.Next() {
		var wpm, acc, cpm, correct, incorrect, dur int
		var created, username string
		if err := rows.Scan(&wpm, &acc, &cpm, &correct, &incorrect, &dur, &created, &username); err != nil {
			continue
		}
		rank++
		entries = append(entries, Entry{
			Rank:           rank,
			Username:       username,
			WPM:            wpm,
			Accuracy:       acc,
			CPM:            cpm,
			CorrectCount:   correct,
			IncorrectCount: incorrect,
			DurationSec:    dur,
			Date:           created,
		})
	}

	writeJSON(w, 200, map[string]any{"entries": entries})
}
