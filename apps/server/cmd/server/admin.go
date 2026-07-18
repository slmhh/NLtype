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

var defaultChinese = []string{
	"季姬寂，集鸡，鸡即棘鸡。棘鸡饥叽，季姬及箕稷济鸡。鸡既济，跻姬笈，季姬忌，急咭鸡，鸡急，继级几，季姬激，即记。",
	"石室诗士施氏，嗜狮，誓食十狮。施氏时时适市视狮。十时，适十狮适市。是时，适施氏适市。施氏视是十狮，恃矢势，使是十狮逝世。",
	"试士试题，试师试拾硕鼠。师使士食鼠，士失食。师拾鼠，实拭，实石，实食，始识鼠实石也。",
	"亚日与雅雅呀呀学语：雅呀呀，亚呀呀。雅呀呀呀？亚呀呀呀！雅呀呀呀呀？亚呀呀呀呀！",
	"矣依倚椅，伊姨倚矣。矣倚椅以咦伊姨。伊姨亦倚椅以咦矣。矣咦伊姨咦矣。咦矣伊姨咦。咦依咦伊姨咦矣咦伊。",
	"吾梧五，午晤五。五午晤吾梧，吾梧无五。五无无，吾梧无。无无无，无无无无无。",
}

var defaultWords = []string{
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
	"quick", "brown", "fox", "jumps", "over", "lazy", "dog", "river", "bank",
	"testing", "purpose", "word", "speed", "typing", "practice", "keyboard",
	"letter", "character", "sentence", "paragraph", "text", "game", "score",
	"high", "level", "time", "minute", "second", "fast", "slow", "accuracy",
}

func loadData() {
	readJSON(filepath.Join(dataDir, "en", "words.json"), &words)
	if len(words) == 0 {
		words = defaultWords
	}
	readJSON(filepath.Join(dataDir, "zh", "texts.json"), &chinese)
	if len(chinese) == 0 {
		chinese = defaultChinese
	}
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
