package main

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLogoutAndBlacklist(t *testing.T) {
	token := registerTestUser(t, "logout_user", "logout@test.com", "password123!")

	// Verify we can access /me with the token
	w := httptest.NewRecorder()
	handleMe(w, authReq("GET", "/api/auth/me", "", token))
	if w.Code != 200 {
		t.Fatalf("expected 200 before logout, got %d", w.Code)
	}

	// Logout
	w2 := httptest.NewRecorder()
	handleLogout(w2, authReq("POST", "/api/auth/logout", "", token))
	if w2.Code != 200 {
		t.Fatalf("logout: expected 200, got %d", w2.Code)
	}

	// Token should now be blacklisted — /me returns 401
	w3 := httptest.NewRecorder()
	handleMe(w3, authReq("GET", "/api/auth/me", "", token))
	if w3.Code != 401 {
		t.Fatalf("expected 401 after logout, got %d", w3.Code)
	}

	// Unauthenticated request to /me still returns 401 (but not blacklisted)
	w4 := httptest.NewRecorder()
	handleMe(w4, testReq("GET", "/api/auth/me", ""))
	if w4.Code != 401 {
		t.Fatalf("expected 401 for no token, got %d", w4.Code)
	}
}

func TestSettingsSaveAndLoad(t *testing.T) {
	token := registerTestUser(t, "settings_user", "settings@test.com", "password123!")

	// Default settings should be empty
	w := httptest.NewRecorder()
	handleGetSettings(w, authReq("GET", "/api/settings", "", token))
	if w.Code != 200 {
		t.Fatalf("get settings: expected 200, got %d", w.Code)
	}
	var getRes struct {
		Settings map[string]any `json:"settings"`
	}
	readBody(w, &getRes)
	if getRes.Settings == nil {
		t.Fatal("expected non-nil settings map")
	}

	// Update settings
	updateBody := `{"settings":{"theme":"dark","soundEnabled":true}}`
	w2 := httptest.NewRecorder()
	handleUpdateSettings(w2, authReq("POST", "/api/settings", updateBody, token))
	if w2.Code != 200 {
		t.Fatalf("update settings: expected 200, got %d", w2.Code)
	}

	// Verify settings are persisted
	w3 := httptest.NewRecorder()
	handleGetSettings(w3, authReq("GET", "/api/settings", "", token))
	if w3.Code != 200 {
		t.Fatalf("get settings after update: expected 200, got %d", w3.Code)
	}
	var getRes2 struct {
		Settings map[string]any `json:"settings"`
	}
	readBody(w3, &getRes2)
	if getRes2.Settings == nil {
		t.Fatal("expected non-nil settings after update")
	}
	theme, ok := getRes2.Settings["theme"]
	if !ok || theme != "dark" {
		t.Fatalf("expected theme=dark, got %v", theme)
	}
}

func TestSettingsInvalidSchema(t *testing.T) {
	token := registerTestUser(t, "settings_invalid", "settings_inv@test.com", "password123!")

	// Unknown key should be rejected
	updateBody := `{"settings":{"nonexistentKey":"value"}}`
	w := httptest.NewRecorder()
	handleUpdateSettings(w, authReq("POST", "/api/settings", updateBody, token))
	if w.Code != 400 {
		t.Fatalf("expected 400 for unknown key, got %d", w.Code)
	}

	// Wrong type for an existing key should be rejected
	updateBody2 := `{"settings":{"wpm":true}}`
	w2 := httptest.NewRecorder()
	handleUpdateSettings(w2, authReq("POST", "/api/settings", updateBody2, token))
	if w2.Code != 400 {
		t.Fatalf("expected 400 for wrong type, got %d", w2.Code)
	}
}

func TestEntryWithCodeLang(t *testing.T) {
	devToken := registerDevUser(t, "entry_code", "entry_code@test.com", "password123!")

	body := `{"language":"code","codeLang":"python","content":"print('hello world')"}`
	w := httptest.NewRecorder()
	handleCreateEntry(w, authReq("POST", "/api/entries", body, devToken))
	if w.Code != 201 {
		t.Fatalf("create code entry: expected 201, got %d", w.Code)
	}

	var created struct {
		Entry WordEntry `json:"entry"`
	}
	readBody(w, &created)
	if created.Entry.CodeLang != "python" {
		t.Fatalf("expected code_lang=python, got %q", created.Entry.CodeLang)
	}

	// List entries should include code_lang
	w2 := httptest.NewRecorder()
	handleListEntries(w2, authReq("GET", "/api/entries", "", devToken))
	if w2.Code != 200 {
		t.Fatalf("list entries: expected 200, got %d", w2.Code)
	}
	var listRes struct {
		Entries []WordEntry `json:"entries"`
	}
	readBody(w2, &listRes)
	found := false
	for _, e := range listRes.Entries {
		if e.CodeLang == "python" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected to find python entry in list")
	}

	// Approved entries filter by code_lang
	w3 := httptest.NewRecorder()
	handleApprovedEntries(w3, testReq("GET", "/api/entries/approved?language=code&code_lang=python", ""))
	if w3.Code != 200 {
		t.Fatalf("approved entries: expected 200, got %d", w3.Code)
	}
	var approvedRes struct {
		Entries []WordEntry `json:"entries"`
	}
	readBody(w3, &approvedRes)
	if len(approvedRes.Entries) < 1 {
		t.Fatal("expected at least 1 approved python entry")
	}
}

func TestResultStats(t *testing.T) {
	token := registerTestUser(t, "stats_user", "stats@test.com", "password123!")

	// Create a result with events
	resultBody := `{"mode":"time","language":"en","wpm":80,"accuracy":90,"cpm":350,"rawWpm":100,"correctCount":70,"incorrectCount":10,"durationSec":30}`
	w := httptest.NewRecorder()
	handleCreateResult(w, authReq("POST", "/api/results", resultBody, token))
	if w.Code != 201 {
		t.Fatalf("create result: expected 201, got %d", w.Code)
	}
	var created struct {
		Result GameResult `json:"result"`
	}
	readBody(w, &created)

	// Check stats endpoint
	w2 := httptest.NewRecorder()
	req2 := authReq("GET", "/api/results/"+itoa(created.Result.ID)+"/stats", "", token)
	req2.SetPathValue("id", itoa(created.Result.ID))
	handleResultStats(w2, req2)
	if w2.Code != 200 {
		t.Fatalf("get stats: expected 200, got %d", w2.Code)
	}
	var statsRes struct {
		Stats *ResultStats `json:"stats"`
	}
	readBody(w2, &statsRes)
	if statsRes.Stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if statsRes.Stats.TotalEvents != 0 {
		t.Fatalf("expected 0 events (no events), got %d", statsRes.Stats.TotalEvents)
	}
}

func TestPasswordResetFlow(t *testing.T) {
	token := registerTestUser(t, "reset_user", "reset@test.com", "password123!")

	// Get the user ID from /me
	w := httptest.NewRecorder()
	handleMe(w, authReq("GET", "/api/auth/me", "", token))
	var meRes struct {
		User struct {
			ID    int    `json:"id"`
			Email string `json:"email"`
		} `json:"user"`
	}
	readBody(w, &meRes)
	userID := meRes.User.ID
	email := meRes.User.Email

	// Request password reset
	w2 := httptest.NewRecorder()
	reqBody := `{"email":"` + email + `"}`
	handleForgotPassword(w2, testReq("POST", "/api/auth/forgot-password", reqBody))
	if w2.Code != 200 {
		t.Fatalf("forgot password: expected 200, got %d", w2.Code)
	}

	// Read the reset token directly from DB (as the server logs it)
	var resetToken string
	err := db.QueryRow(
		"SELECT token FROM password_reset_tokens WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1",
		userID,
	).Scan(&resetToken)
	if err != nil {
		t.Fatalf("query reset token: %v", err)
	}
	if resetToken == "" {
		t.Fatal("expected non-empty reset token in DB")
	}

	// Use the token to reset password
	newPass := "newpassword456!"
	w3 := httptest.NewRecorder()
	resetBody := `{"token":"` + resetToken + `","newPassword":"` + newPass + `"}`
	handleResetPassword(w3, testReq("POST", "/api/auth/reset-password", resetBody))
	if w3.Code != 200 {
		t.Fatalf("reset password: expected 200, got %d", w3.Code)
	}

	// Verify we can login with the new password
	w4 := httptest.NewRecorder()
	loginBody := `{"identifier":"reset_user","password":"` + newPass + `"}`
	handleLogin(w4, testReq("POST", "/api/auth/login", loginBody))
	if w4.Code != 200 {
		t.Fatalf("login with new password: expected 200, got %d", w4.Code)
	}
}

func TestForgotPasswordRateLimit(t *testing.T) {
	// Create a user
	token := registerTestUser(t, "ratelimit_user", "ratelimit@test.com", "password123!")
	w := httptest.NewRecorder()
	handleMe(w, authReq("GET", "/api/auth/me", "", token))
	var meRes struct {
		User struct {
			Email string `json:"email"`
		} `json:"user"`
	}
	readBody(w, &meRes)

	// Use a fixed IP to test rate limiting
	makeReq := func(body string) *http.Request {
		req := httptest.NewRequest("POST", "/api/auth/forgot-password", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "10.0.0.1:12345"
		return req
	}

	// Exhaust the rate limit (3 requests per minute per IP)
	for i := 0; i < 3; i++ {
		w2 := httptest.NewRecorder()
		body := `{"email":"` + meRes.User.Email + `"}`
		handleForgotPassword(w2, makeReq(body))
		if w2.Code != 200 {
			t.Fatalf("iteration %d: expected 200, got %d", i, w2.Code)
		}
	}

	// Fourth request should be rate limited
	w3 := httptest.NewRecorder()
	body := `{"email":"` + meRes.User.Email + `"}`
	handleForgotPassword(w3, makeReq(body))
	if w3.Code != 429 {
		t.Fatalf("expected 429 after rate limit, got %d", w3.Code)
	}
}

func TestResetPasswordInvalidToken(t *testing.T) {
	w := httptest.NewRecorder()
	body := `{"token":"invalidtoken123","newPassword":"newpassword456!"}`
	handleResetPassword(w, testReq("POST", "/api/auth/reset-password", body))
	if w.Code != 400 {
		t.Fatalf("expected 400 for invalid token, got %d", w.Code)
	}
}

func TestResultStatsWithEvents(t *testing.T) {
	token := registerTestUser(t, "stats_events", "stats_events@test.com", "password123!")

	// Create a result
	resultBody := `{"mode":"time","language":"en","wpm":85,"accuracy":92,"cpm":370,"rawWpm":105,"correctCount":75,"incorrectCount":8,"durationSec":30}`
	w := httptest.NewRecorder()
	handleCreateResult(w, authReq("POST", "/api/results", resultBody, token))
	if w.Code != 201 {
		t.Fatalf("create result: expected 201, got %d", w.Code)
	}
	var created struct {
		Result GameResult `json:"result"`
	}
	readBody(w, &created)

	// Insert some typing events directly via SQL
	rows := []struct {
		resultID int
		expected string
		typed    string
		latency  int
		correct  int
		elapsed  int
	}{
		{created.Result.ID, "a", "a", 80, 1, 100},
		{created.Result.ID, "b", "b", 120, 1, 200},
		{created.Result.ID, "c", "x", 150, 0, 300},
		{created.Result.ID, "d", "d", 90, 1, 400},
	}
	tx, _ := db.Begin()
	for _, r := range rows {
		tx.Exec("INSERT INTO typing_events (result_id, char_index, expected_char, typed_char, latency_ms, is_correct, elapsed_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
			r.resultID, 0, r.expected, r.typed, r.latency, r.correct, r.elapsed)
	}
	tx.Commit()

	// Check stats
	w2 := httptest.NewRecorder()
	req2 := authReq("GET", "/api/results/"+itoa(created.Result.ID)+"/stats", "", token)
	req2.SetPathValue("id", itoa(created.Result.ID))
	handleResultStats(w2, req2)
	if w2.Code != 200 {
		t.Fatalf("get stats: expected 200, got %d", w2.Code)
	}

	var statsRes struct {
		Stats *ResultStats `json:"stats"`
	}
	readBody(w2, &statsRes)
	if statsRes.Stats == nil {
		t.Fatal("expected non-nil stats")
	}
	if statsRes.Stats.TotalEvents != 4 {
		t.Fatalf("expected 4 events, got %d", statsRes.Stats.TotalEvents)
	}
	if len(statsRes.Stats.ErrorMap) != 1 {
		t.Fatalf("expected 1 error entry, got %d", len(statsRes.Stats.ErrorMap))
	}
	if statsRes.Stats.AvgLatencyMs != 110 {
		t.Fatalf("expected avg latency 110, got %d", statsRes.Stats.AvgLatencyMs)
	}
	if statsRes.Stats.MaxLatencyMs != 150 {
		t.Fatalf("expected max latency 150, got %d", statsRes.Stats.MaxLatencyMs)
	}
}

func TestUnauthenticatedAccess(t *testing.T) {
	protectedEndpoints := []struct {
		method string
		path   string
		body   string
	}{
		{"GET", "/api/auth/me", ""},
		{"POST", "/api/auth/logout", ""},
		{"GET", "/api/settings", ""},
		{"POST", "/api/settings", `{"settings":{"theme":"dark"}}`},
		{"GET", "/api/results", ""},
		{"POST", "/api/results", `{"mode":"time","language":"en","wpm":80,"accuracy":90,"cpm":350,"rawWpm":100,"correctCount":70,"incorrectCount":10,"durationSec":30}`},
		{"GET", "/api/entries", ""},
		{"POST", "/api/entries", `{"language":"en","content":"test content."}`},
		{"GET", "/api/admin/stats", ""},
	}
	for _, ep := range protectedEndpoints {
		w := httptest.NewRecorder()
		var handler http.HandlerFunc
		switch {
		case strings.HasPrefix(ep.path, "/api/auth/me"):
			handler = handleMe
		case strings.HasPrefix(ep.path, "/api/auth/logout"):
			handler = handleLogout
		case strings.HasPrefix(ep.path, "/api/settings"):
			if ep.method == "GET" {
				handler = handleGetSettings
			} else {
				handler = handleUpdateSettings
			}
		case strings.HasPrefix(ep.path, "/api/results"):
			if ep.method == "GET" {
				handler = handleGetResults
			} else {
				handler = handleCreateResult
			}
		case strings.HasPrefix(ep.path, "/api/entries"):
			handler = handleListEntries
		case strings.HasPrefix(ep.path, "/api/admin/stats"):
			handler = handleAdminStats
		}
		handler(w, testReq(ep.method, ep.path, ep.body))
		if w.Code == 200 {
			t.Errorf("endpoint %s %s should not return 200 without auth", ep.method, ep.path)
		}
	}
}

func TestWordsHandler(t *testing.T) {
	w := httptest.NewRecorder()
	wordsHandler(w, testReq("GET", "/api/text/words", ""))
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res struct {
		Words []string `json:"words"`
	}
	readBody(w, &res)
	if len(res.Words) == 0 {
		t.Fatal("expected non-empty words list")
	}
}

func itoa(n int) string {
	return fmt.Sprint(n)
}
