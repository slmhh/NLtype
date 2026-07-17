package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"html"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	dataDir string
	distDir string
	jwtKey  []byte
	mu      sync.RWMutex
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func findDataDir() string {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	candidates := []string{
		filepath.Join(dir, "data"),
		filepath.Join(dir, "..", "..", "data"),
		"apps/server/data",
		"data",
	}
	for _, d := range candidates {
		abs, _ := filepath.Abs(d)
		if info, err := os.Stat(abs); err == nil && info.IsDir() {
			return abs
		}
	}
	dataDir := filepath.Join(dir, "data")
	os.MkdirAll(dataDir, 0755)
	return dataDir
}

func readJSON(path string, v any) error {
	mu.RLock()
	defer mu.RUnlock()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			os.WriteFile(path, []byte("[]"), 0644)
			return json.Unmarshal([]byte("[]"), v)
		}
		return err
	}
	return json.Unmarshal(data, v)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ���� JWT ����

type Claims struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

func signToken(claims Claims) string {
	claims.IssuedAt = time.Now().Unix()
	claims.ExpiresAt = time.Now().Add(24 * time.Hour).Unix()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString(mustJSON(claims))
	sig := hmacSHA256(jwtKey, header+"."+payload)
	return header + "." + payload + "." + sig
}

func verifyToken(token string) (*Claims, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, false
	}
	sig := hmacSHA256(jwtKey, parts[0]+"."+parts[1])
	if sig != parts[2] {
		return nil, false
	}
	data, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, false
	}
	var c Claims
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, false
	}
	if c.ExpiresAt == 0 || time.Now().Unix() > c.ExpiresAt {
		return nil, false
	}
	return &c, true
}

func mustJSON(v any) []byte {
	data, _ := json.Marshal(v)
	return data
}

func hmacSHA256(key []byte, data string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func getAuthUser(r *http.Request) *Claims {
	token := getRawToken(r)
	if token == "" {
		return nil
	}
	c, ok := verifyToken(token)
	if !ok {
		return nil
	}
	if isTokenBlacklisted(token) {
		return nil
	}
	return c
}

// ���� Permission helpers ����

type Role string

const (
	RoleUser      Role = "user"
	RoleAdmin     Role = "admin"
	RoleDeveloper Role = "developer"
)

var rolePermissions = map[Role][]string{
	RoleUser:      {"game:play", "leaderboard:view"},
	RoleAdmin:     {"game:play", "leaderboard:view", "users:view", "admin:panel", "users:manage"},
	RoleDeveloper: {"game:play", "leaderboard:view", "users:view", "admin:panel", "users:manage", "users:ban", "system:config", "roles:assign"},
}

func hasPermission(role Role, perm string) bool {
	for _, p := range rolePermissions[role] {
		if p == perm {
			return true
		}
	}
	return false
}

// ���� CORS middleware (dev only; in production frontend is served from same origin) ����

func cors(next http.Handler) http.Handler {
	origin := getEnv("CORS_ORIGIN", "")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(204)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// ���� Security headers ����

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-XSS-Protection", "0")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'")
		next.ServeHTTP(w, r)
	})
}

// ���� Rate limiter ����

type rateRecord struct {
	count   int
	resetAt int64
}

var (
	rateMu    sync.Mutex
	rateLimit = make(map[int]*rateRecord)
)

type ipRateRecord struct {
	count   int
	resetAt int64
}

var (
	ipRateMu    sync.Mutex
	ipRateLimit = make(map[string]*ipRateRecord)
)

func checkIPRateLimit(ip string, max int, windowMs int64) bool {
	now := time.Now().UnixMilli()
	ipRateMu.Lock()
	defer ipRateMu.Unlock()
	rec := ipRateLimit[ip]
	if rec == nil || now > rec.resetAt {
		ipRateLimit[ip] = &ipRateRecord{count: 1, resetAt: now + windowMs}
		return true
	}
	if rec.count >= max {
		return false
	}
	rec.count++
	return true
}

func checkRateLimit(userID int, maxPerHour int) bool {
	now := time.Now().UnixMilli()
	rateMu.Lock()
	defer rateMu.Unlock()
	rec := rateLimit[userID]
	if rec == nil || now > rec.resetAt {
		rateLimit[userID] = &rateRecord{count: 1, resetAt: now + 3600000}
		return true
	}
	if rec.count >= maxPerHour {
		return false
	}
	rec.count++
	return true
}

// ���� Text sanitize ����

func sanitizeContent(s string) string {
	s = strings.TrimSpace(strings.Map(func(r rune) rune {
		if r >= 0x00 && r <= 0x08 || r == 0x0B || r == 0x0C || r >= 0x0E && r <= 0x1F {
			return -1
		}
		return r
	}, s))
	s = html.EscapeString(s)
	return s
}

// ���� Security helpers ����

func realIP(r *http.Request) string {
	return r.RemoteAddr
}

func limitBody(r *http.Request) {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20) // 1 MB
}

func getRawToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return auth[7:]
}

func tokenHash(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func blacklistToken(token string, expiresAt int64) {
	hash := tokenHash(token)
	expires := time.Unix(expiresAt, 0).UTC().Format("2006-01-02T15:04:05Z")
	now := nowISO()
	db.Exec("INSERT OR IGNORE INTO token_blacklist (token_hash, expires_at, created_at) VALUES (?, ?, ?)", hash, expires, now)
}

func isTokenBlacklisted(token string) bool {
	hash := tokenHash(token)
	var count int
	db.QueryRow("SELECT COUNT(*) FROM token_blacklist WHERE token_hash = ?", hash).Scan(&count)
	return count > 0
}

// ���� Helpers ����

func timeNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func parseID(s string) (int, error) {
	return strconv.Atoi(s)
}

// ���� Main ����

func spaFileServer(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(distDir, r.URL.Path)
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		http.ServeFile(w, r, path)
		return
	}
	// SPA fallback: serve index.html for client-side routing
	http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
}

func main() {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters long")
	}
	jwtKey = []byte(jwtSecret)

	dataDir = findDataDir()
	distDir = getEnv("STATIC_DIR", "./dist")
	log.Printf("Data directory: %s", dataDir)
	log.Printf("Static directory: %s", distDir)

	if err := initDB(dataDir); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	log.Println("Database initialized")

	seedCodeEntries()

	loadData()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", healthHandler)
	mux.HandleFunc("GET /api/text/english", englishHandler)
	mux.HandleFunc("GET /api/text/chinese", chineseHandler)

	mux.HandleFunc("POST /api/auth/register", handleRegister)
	mux.HandleFunc("POST /api/auth/login", handleLogin)
	mux.HandleFunc("POST /api/auth/logout", handleLogout)
	mux.HandleFunc("GET /api/auth/me", handleMe)
	mux.HandleFunc("POST /api/auth/forgot-password", handleForgotPassword)
	mux.HandleFunc("POST /api/auth/reset-password", handleResetPassword)
	mux.HandleFunc("GET /api/auth/verify-email", handleVerifyEmail)
	mux.HandleFunc("POST /api/auth/send-verification", handleSendVerification)
	mux.HandleFunc("GET /api/auth/settings", handleGetSettings)
	mux.HandleFunc("PATCH /api/auth/settings", handleUpdateSettings)
	mux.HandleFunc("GET /api/auth/users", handleListUsers)
	mux.HandleFunc("PATCH /api/auth/users/{id}/role", handleUpdateRole)

	mux.HandleFunc("POST /api/results", handleCreateResult)
	mux.HandleFunc("GET /api/results", handleGetResults)
	mux.HandleFunc("GET /api/results/best", handlePersonalBests)
	mux.HandleFunc("GET /api/results/leaderboard", handleLeaderboard)
	mux.HandleFunc("DELETE /api/results", handleClearResults)
	mux.HandleFunc("GET /api/results/{id}/stats", handleResultStats)

	mux.HandleFunc("POST /api/entries", handleCreateEntry)
	mux.HandleFunc("GET /api/entries", handleListEntries)
	mux.HandleFunc("GET /api/entries/approved", handleApprovedEntries)
	mux.HandleFunc("PATCH /api/entries/{id}/review", handleReviewEntry)

	mux.HandleFunc("GET /api/admin/stats", handleAdminStats)

	// Daily challenge
	mux.HandleFunc("GET /api/daily", handleDailyChallenge)
	mux.HandleFunc("POST /api/daily/attempt", handleSubmitDailyAttempt)
	mux.HandleFunc("GET /api/daily/leaderboard", handleDailyLeaderboard)

	// SPA fallback for all non-API routes
	mux.HandleFunc("/", spaFileServer)

	port := getEnv("PORT", "3001")
	log.Printf("Server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, securityHeaders(cors(mux))))
}
