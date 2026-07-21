package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func generateResetToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	limitBody(r)
	ip := realIP(r)
	if !checkIPRateLimit(ip, 3, 60000) {
		writeError(w, 429, "Too many requests. Please try again later.")
		return
	}

	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if body.Email == "" {
		writeError(w, 400, "Email is required")
		return
	}

	var userID int
	err := db.QueryRow("SELECT id FROM users WHERE email = ?", body.Email).Scan(&userID)
	if err != nil {
		// Don't reveal whether email exists
		writeJSON(w, 200, map[string]any{"ok": true})
		return
	}

	token, err := generateResetToken()
	if err != nil {
		log.Printf("generate reset token: %v", err)
		writeError(w, 500, "Internal error")
		return
	}

	expiresAt := time.Now().UTC().Add(1 * time.Hour).Format("2006-01-02T15:04:05Z")
	created := nowISO()

	_, err = db.Exec(
		"INSERT INTO password_reset_tokens (user_id, token, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)",
		userID, token, expiresAt, created,
	)
	if err != nil {
		log.Printf("save reset token: %v", err)
		writeError(w, 500, "Internal error")
		return
	}

	writeJSON(w, 200, map[string]any{"ok": true})
}

func handleResetPassword(w http.ResponseWriter, r *http.Request) {
	limitBody(r)
	ip := realIP(r)
	if !checkIPRateLimit(ip, 5, 60000) {
		writeError(w, 429, "Too many requests. Please try again later.")
		return
	}

	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if body.Token == "" || body.NewPassword == "" {
		writeError(w, 400, "Missing fields")
		return
	}
	if len(body.NewPassword) < 8 || len(body.NewPassword) > 128 {
		writeError(w, 400, "Password must be 8-128 characters")
		return
	}

	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	var userID int
	var tokenID int
	err := db.QueryRow(
		`SELECT id, user_id FROM password_reset_tokens
		 WHERE token = ? AND used = 0 AND expires_at > ?`, body.Token, now,
	).Scan(&tokenID, &userID)
	if err != nil {
		writeError(w, 400, "Invalid or expired token")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), 12)
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}

	_, err = db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), userID)
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}

	if _, err := db.Exec("UPDATE password_reset_tokens SET used = 1 WHERE id = ?", tokenID); err != nil {
		log.Printf("failed to mark token %d as used: %v", tokenID, err)
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}
