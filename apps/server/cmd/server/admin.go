package main

import (
	"log"
	"math/rand"
	"net/http"
	"path/filepath"
	"strings"
)

// ── Legacy text endpoints ──

var words []string
var chinese []string

func loadData() {
	readJSON(filepath.Join(dataDir, "en", "words.json"), &words)
	readJSON(filepath.Join(dataDir, "zh", "texts.json"), &chinese)
}



func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func wordsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"words": words})
}

func englishHandler(w http.ResponseWriter, r *http.Request) {
	const targetLen = 200
	var selected []string
	length := 0
	for length < targetLen {
		w := words[rand.Intn(len(words))]
		selected = append(selected, w)
		length += len(w) + 1
	}
	writeJSON(w, 200, map[string]string{"text": strings.Join(selected[:len(selected)-1], " ")})
}

func chineseHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"text": chinese[rand.Intn(len(chinese))]})
}

// ── Admin stats ──

type Stats struct {
	TotalUsers     int            `json:"totalUsers"`
	TotalResults   int            `json:"totalResults"`
	ResultsByMode  map[string]int `json:"resultsByMode"`
	ResultsByLang  map[string]int `json:"resultsByLang"`
	TopWPM         int            `json:"topWpm"`
	AvgWPM         int            `json:"avgWpm"`
}

func handleAdminStats(w http.ResponseWriter, r *http.Request) {
	limitBody(r)
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "admin:panel") {
		writeError(w, 403, "Insufficient permissions")
		return
	}

	var stats Stats

	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
	db.QueryRow("SELECT COUNT(*) FROM results").Scan(&stats.TotalResults)

	// Mode distribution
	if rows, err := db.Query("SELECT mode, COUNT(*) FROM results GROUP BY mode"); err == nil {
		defer rows.Close()
		stats.ResultsByMode = make(map[string]int)
		for rows.Next() {
			var mode string
			var count int
			if err := rows.Scan(&mode, &count); err != nil {
				log.Printf("scan mode stats row: %v", err)
				continue
			}
			stats.ResultsByMode[mode] = count
		}
	} else {
		log.Printf("query mode distribution: %v", err)
	}
	if stats.ResultsByMode == nil {
		stats.ResultsByMode = map[string]int{}
	}

	// Language distribution
	if rows, err := db.Query("SELECT language, COUNT(*) FROM results GROUP BY language"); err == nil {
		defer rows.Close()
		stats.ResultsByLang = make(map[string]int)
		for rows.Next() {
			var lang string
			var count int
			if err := rows.Scan(&lang, &count); err != nil {
				log.Printf("scan language stats row: %v", err)
				continue
			}
			stats.ResultsByLang[lang] = count
		}
	} else {
		log.Printf("query language distribution: %v", err)
	}
	if stats.ResultsByLang == nil {
		stats.ResultsByLang = map[string]int{}
	}

	db.QueryRow("SELECT COALESCE(MAX(wpm), 0) FROM results").Scan(&stats.TopWPM)
	db.QueryRow("SELECT COALESCE(ROUND(AVG(wpm)), 0) FROM results").Scan(&stats.AvgWPM)

	writeJSON(w, 200, map[string]any{"stats": stats})
}
