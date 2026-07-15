package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	dir, _ := os.MkdirTemp("", "nltype-test")
	dataDir = dir
	if err := initDB(dir); err != nil {
		os.Exit(1)
	}
	jwtKey = []byte("test-secret")
	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

func readBody(w *httptest.ResponseRecorder, v any) {
	json.NewDecoder(w.Body).Decode(v)
}

func authHeader(token string) string {
	return "Bearer " + token
}

func testReq(method, path, body string) *http.Request {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func authReq(method, path, body, token string) *http.Request {
	req := testReq(method, path, body)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

// ── Helper to register a user and return token ──

func registerTestUser(t *testing.T, username, email, password string) string {
	t.Helper()
	body := `{"username":"` + username + `","email":"` + email + `","password":"` + password + `"}`
	w := httptest.NewRecorder()
	handleRegister(w, testReq("POST", "/api/auth/register", body))
	if w.Code != 201 {
		t.Fatalf("register: got status %d", w.Code)
	}
	var res struct {
		Token string `json:"token"`
	}
	readBody(w, &res)
	return res.Token
}

func registerDevUser(t *testing.T, username, email, password string) string {
	t.Helper()
	body := `{"username":"` + username + `","email":"` + email + `","password":"` + password + `"}`
	w := httptest.NewRecorder()
	handleRegister(w, testReq("POST", "/api/auth/register", body))
	if w.Code != 201 {
		t.Fatalf("register: got status %d", w.Code)
	}
	var res struct {
		Token string `json:"token"`
		User  struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
		} `json:"user"`
	}
	readBody(w, &res)
	updateUserRole(res.User.ID, RoleDeveloper)
	return signToken(Claims{ID: res.User.ID, Username: res.User.Username, Role: "developer"})
}

// ── Tests ──

func TestHealth(t *testing.T) {
	w := httptest.NewRecorder()
	healthHandler(w, testReq("GET", "/api/health", ""))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res map[string]string
	readBody(w, &res)
	if res["status"] != "ok" {
		t.Fatalf("expected ok, got %s", res["status"])
	}
}

func TestRegister(t *testing.T) {
	token := registerTestUser(t, "alice", "alice@test.com", "password123!")
	if token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestRegisterDuplicate(t *testing.T) {
	registerTestUser(t, "bob", "bob@test.com", "password123!")
	w := httptest.NewRecorder()
	body := `{"username":"bob","email":"bob2@test.com","password":"password123!"}`
	handleRegister(w, testReq("POST", "/api/auth/register", body))
	if w.Code != 409 {
		t.Fatalf("expected 409 for duplicate username, got %d", w.Code)
	}
}

func TestLogin(t *testing.T) {
	registerTestUser(t, "carol", "carol@test.com", "password123!")
	w := httptest.NewRecorder()
	body := `{"identifier":"carol","password":"password123!"}`
	handleLogin(w, testReq("POST", "/api/auth/login", body))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res struct {
		Token string `json:"token"`
		User  struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
		} `json:"user"`
	}
	readBody(w, &res)
	if res.Token == "" {
		t.Fatal("expected non-empty token")
	}
	if res.User.Username != "carol" {
		t.Fatalf("expected carol, got %s", res.User.Username)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	registerTestUser(t, "dave", "dave@test.com", "password123!")
	w := httptest.NewRecorder()
	body := `{"identifier":"dave","password":"wrongpassword"}`
	handleLogin(w, testReq("POST", "/api/auth/login", body))
	if w.Code != 401 {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestMe(t *testing.T) {
	token := registerTestUser(t, "eve", "eve@test.com", "password123!")
	w := httptest.NewRecorder()
	handleMe(w, authReq("GET", "/api/auth/me", "", token))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res struct {
		User struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
		} `json:"user"`
	}
	readBody(w, &res)
	if res.User.Username != "eve" {
		t.Fatalf("expected eve, got %s", res.User.Username)
	}
}

func TestMeUnauthenticated(t *testing.T) {
	w := httptest.NewRecorder()
	handleMe(w, testReq("GET", "/api/auth/me", ""))
	if w.Code != 401 {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestCreateAndGetResults(t *testing.T) {
	token := registerTestUser(t, "frank", "frank@test.com", "password123!")
	resultBody := `{"mode":"time","language":"en","wpm":100,"accuracy":90,"cpm":400,"rawWpm":120,"correctCount":80,"incorrectCount":10,"durationSec":30}`
	w := httptest.NewRecorder()
	handleCreateResult(w, authReq("POST", "/api/results", resultBody, token))
	if w.Code != 201 {
		t.Fatalf("create result: expected 201, got %d", w.Code)
	}

	w2 := httptest.NewRecorder()
	handleGetResults(w2, authReq("GET", "/api/results", "", token))
	if w2.Code != 200 {
		t.Fatalf("get results: expected 200, got %d", w2.Code)
	}
	var res struct {
		Results []GameResult `json:"results"`
	}
	readBody(w2, &res)
	if len(res.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(res.Results))
	}
	if res.Results[0].WPM != 100 {
		t.Fatalf("expected WPM 100, got %d", res.Results[0].WPM)
	}
}

func TestLeaderboard(t *testing.T) {
	token := registerTestUser(t, "grace", "grace@test.com", "password123!")
	for i := 0; i < 3; i++ {
		body := `{"mode":"time","language":"en","wpm":100,"accuracy":90,"cpm":400,"rawWpm":120,"correctCount":80,"incorrectCount":10,"durationSec":30}`
		w := httptest.NewRecorder()
		handleCreateResult(w, authReq("POST", "/api/results", body, token))
		if w.Code != 201 {
			t.Fatalf("create result %d: expected 201, got %d", i, w.Code)
		}
	}
	w := httptest.NewRecorder()
	handleLeaderboard(w, testReq("GET", "/api/results/leaderboard?limit=10", ""))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res struct {
		Entries []LeaderboardEntry `json:"entries"`
	}
	readBody(w, &res)
	if len(res.Entries) < 1 {
		t.Fatal("expected at least 1 leaderboard entry")
	}
}

func TestPersonalBests(t *testing.T) {
	token := registerTestUser(t, "heidi", "heidi@test.com", "password123!")
	// Two results in same mode+lang, one better
	body1 := `{"mode":"time","language":"en","wpm":80,"accuracy":85,"cpm":300,"rawWpm":100,"correctCount":60,"incorrectCount":10,"durationSec":30}`
	handleCreateResult(httptest.NewRecorder(), authReq("POST", "/api/results", body1, token))
	body2 := `{"mode":"time","language":"en","wpm":120,"accuracy":95,"cpm":500,"rawWpm":140,"correctCount":100,"incorrectCount":5,"durationSec":45}`
	handleCreateResult(httptest.NewRecorder(), authReq("POST", "/api/results", body2, token))

	w := httptest.NewRecorder()
	handlePersonalBests(w, authReq("GET", "/api/results/best", "", token))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res struct {
		Bests []PersonalBest `json:"bests"`
	}
	readBody(w, &res)
	if len(res.Bests) != 1 {
		t.Fatalf("expected 1 best, got %d", len(res.Bests))
	}
	if res.Bests[0].WPM != 120 {
		t.Fatalf("expected best WPM 120, got %d", res.Bests[0].WPM)
	}
}

func TestCreateAndReviewEntry(t *testing.T) {
	devToken := registerDevUser(t, "ivan", "ivan@test.com", "password123!")
	// Create entry
	body := `{"language":"en","content":"The quick brown fox jumps over the lazy dog near the riverbank for testing purposes."}`
	w := httptest.NewRecorder()
	handleCreateEntry(w, authReq("POST", "/api/entries", body, devToken))
	if w.Code != 201 {
		t.Fatalf("create entry: expected 201, got %d", w.Code)
	}
	var created struct {
		Entry WordEntry `json:"entry"`
	}
	readBody(w, &created)
	if created.Entry.Status != "approved" {
		t.Fatalf("developer entry should be auto-approved, got %s", created.Entry.Status)
	}
	// List entries
	w2 := httptest.NewRecorder()
	handleListEntries(w2, authReq("GET", "/api/entries", "", devToken))
	if w2.Code != 200 {
		t.Fatalf("list entries: expected 200, got %d", w2.Code)
	}
	// Approved entries
	w3 := httptest.NewRecorder()
	handleApprovedEntries(w3, testReq("GET", "/api/entries/approved?language=en", ""))
	if w3.Code != 200 {
		t.Fatalf("approved entries: expected 200, got %d", w3.Code)
	}
	var approved struct {
		Entries []WordEntry `json:"entries"`
	}
	readBody(w3, &approved)
	if len(approved.Entries) != 1 {
		t.Fatalf("expected 1 approved entry, got %d", len(approved.Entries))
	}
}

func TestAdminStats(t *testing.T) {
	// Register a regular user (first user is developer)
	devToken := registerDevUser(t, "judy", "judy@test.com", "password123!")
	// Create a result
	handleCreateResult(httptest.NewRecorder(), authReq("POST", "/api/results", `{"mode":"time","language":"en","wpm":100,"accuracy":90,"cpm":400,"rawWpm":120,"correctCount":80,"incorrectCount":10,"durationSec":30}`, devToken))
	// Stats
	w := httptest.NewRecorder()
	handleAdminStats(w, authReq("GET", "/api/admin/stats", "", devToken))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res struct {
		Stats Stats `json:"stats"`
	}
	readBody(w, &res)
	if res.Stats.TotalUsers < 1 {
		t.Fatal("expected at least 1 user")
	}
	if res.Stats.TotalResults < 1 {
		t.Fatal("expected at least 1 result")
	}
}

func TestAdminStatsUnauthorized(t *testing.T) {
	nonAdminToken := registerTestUser(t, "karen", "karen@test.com", "password123!")
	w := httptest.NewRecorder()
	handleAdminStats(w, authReq("GET", "/api/admin/stats", "", nonAdminToken))
	if w.Code == 200 {
		t.Fatal("expected non-200 for non-admin user")
	}
}
