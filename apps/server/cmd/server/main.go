package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"log"
)

var words []string
var chinese []string

func findDataDir() string {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)

	candidates := []string{
		filepath.Join(dir, "data"),
		filepath.Join(dir, "..", "data"),
		"apps/server/data",
		"data",
	}
	for _, d := range candidates {
		abs, _ := filepath.Abs(d)
		if _, err := os.Stat(filepath.Join(abs, "en", "words.json")); err == nil {
			return abs
		}
	}
	return filepath.Join(dir, "data")
}

func loadData() {
	dir := findDataDir()
	log.Printf("Loading data from: %s", dir)
	data, err := os.ReadFile(filepath.Join(dir, "en", "words.json"))
	if err != nil { log.Fatalf("en/words.json: %v", err) }
	json.Unmarshal(data, &words)
	data, err = os.ReadFile(filepath.Join(dir, "zh", "texts.json"))
	if err != nil { log.Fatalf("zh/texts.json: %v", err) }
	json.Unmarshal(data, &chinese)
	log.Printf("Loaded %d English words, %d Chinese texts", len(words), len(chinese))
}

func writeJSON(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		if r.Method == "OPTIONS" { w.WriteHeader(204); return }
		next.ServeHTTP(w, r)
	})
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<!DOCTYPE html>
<html><head><title>TypeRush API</title>
<meta charset="utf-8">
<style>body{font-family:monospace;background:#1e1e2e;color:#cdd6f4;max-width:600px;margin:40px auto;padding:20px;}
a{color:#89b4fa}h1{color:#a6e3a1}code{background:#313244;padding:2px 6px;border-radius:4px;}</style>
<body>
<h1>TypeRush API</h1>
<p>Backend server is running.</p>
<h2>Endpoints</h2>
<ul>
<li><code>GET /api/health</code> — Health check</li>
<li><code>GET /api/text/english</code> — Random English text</li>
<li><code>GET /api/text/chinese</code> — Random Chinese text</li>
</ul>
<p><a href="/api/health">/api/health</a></p>
<p><a href="/api/text/english">/api/text/english</a></p>
<p><a href="/">Frontend → http://localhost:5173/</a></p>
</body></html>`))
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
	writeJSON(w, map[string]string{"text": strings.Join(selected[:len(selected)-1], " ")})
}

func chineseHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"text": chinese[rand.Intn(len(chinese))]})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func main() {
	loadData()
	mux := http.NewServeMux()
	mux.HandleFunc("/", rootHandler)
	mux.HandleFunc("GET /api/health", healthHandler)
	mux.HandleFunc("GET /api/text/english", englishHandler)
	mux.HandleFunc("GET /api/text/chinese", chineseHandler)

	port := os.Getenv("PORT")
	if port == "" { port = "3001" }
	log.Printf("Server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, cors(mux)))
}
