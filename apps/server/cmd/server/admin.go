package main

import (
	"math/rand"
	"net/http"
	"path/filepath"
	"strings"
)

// ── Existing text endpoints ──

var words []string
var chinese []string

func loadData() {
	readJSON(filepath.Join(dataDir, "en", "words.json"), &words)
	readJSON(filepath.Join(dataDir, "zh", "texts.json"), &chinese)
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<!DOCTYPE html>
<html><head><title>NLType API</title>
<meta charset="utf-8">
<style>body{font-family:monospace;background:#1e1e2e;color:#cdd6f4;max-width:600px;margin:40px auto;padding:20px;}
a{color:#89b4fa}h1{color:#a6e3a1}code{background:#313244;padding:2px 6px;border-radius:4px;}</style>
<body>
<h1>NLType API</h1>
<p>Backend server is running.</p>
<h2>Endpoints</h2>
<ul>
<li><code>GET /api/health</code></li>
<li><code>GET /api/text/english</code></li>
<li><code>GET /api/text/chinese</code></li>
</ul>
<p><a href="/api/health">/api/health</a></p>
</body></html>`))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok"})
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
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "admin:panel") {
		writeError(w, 403, "Insufficient permissions")
		return
	}

	modeCount := make(map[string]int)
	langCount := make(map[string]int)
	var totalWPM, topWPM int

	for _, res := range results {
		modeCount[res.Mode]++
		langCount[res.Language]++
		totalWPM += res.WPM
		if res.WPM > topWPM {
			topWPM = res.WPM
		}
	}

	avgWPM := 0
	if len(results) > 0 {
		avgWPM = totalWPM / len(results)
	}

	stats := Stats{
		TotalUsers:    len(users),
		TotalResults:  len(results),
		ResultsByMode: modeCount,
		ResultsByLang: langCount,
		TopWPM:        topWPM,
		AvgWPM:        avgWPM,
	}
	writeJSON(w, 200, map[string]any{"stats": stats})
}
