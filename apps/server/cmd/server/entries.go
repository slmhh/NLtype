package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
)

type WordEntry struct {
	ID         int    `json:"id"`
	UserID     int    `json:"userId"`
	Username   string `json:"username"`
	Language   string `json:"language"`
	Content    string `json:"content"`
	Status     string `json:"status"`
	CreatedAt  string `json:"createdAt"`
	ReviewedAt string `json:"reviewedAt,omitempty"`
	ReviewedBy int    `json:"reviewedBy,omitempty"`
}

// ── Handlers ──

func handleCreateEntry(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	var body struct {
		Language string `json:"language"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}

	validLangs := map[string]bool{"en": true, "zh": true, "code": true}
	if !validLangs[body.Language] {
		writeError(w, 400, "Invalid language")
		return
	}

	sanitized := sanitizeContent(body.Content)
	if len(sanitized) < 10 {
		writeError(w, 400, "Content too short (min 10 chars)")
		return
	}
	if len(sanitized) > 10000 {
		writeError(w, 400, "Content too long (max 10000 chars)")
		return
	}

	if !checkRateLimit(claims.ID, 20) {
		writeError(w, 429, "Too many submissions (max 20/hour)")
		return
	}

	status := "pending"
	reviewedAt := ""
	reviewedBy := 0
	if claims.Role == "developer" {
		status = "approved"
		reviewedAt = nowISO()
		reviewedBy = claims.ID
	}

	created := nowISO()
	var id int
	err := db.QueryRow(
		`INSERT INTO entries (user_id, username, language, content, status, created_at, reviewed_at, reviewed_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		claims.ID, claims.Username, body.Language, sanitized, status, created, nullStr(reviewedAt), nullInt(reviewedBy),
	).Scan(&id)
	if err != nil {
		writeError(w, 500, "Failed to create entry")
		return
	}

	entry := WordEntry{
		ID:         id,
		UserID:     claims.ID,
		Username:   claims.Username,
		Language:   body.Language,
		Content:    sanitized,
		Status:     status,
		CreatedAt:  created,
		ReviewedAt: reviewedAt,
		ReviewedBy: reviewedBy,
	}
	writeJSON(w, 201, map[string]any{"entry": entry})
}

func handleListEntries(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	isAdmin := claims.Role == "admin" || claims.Role == "developer"
	statusFilter := r.URL.Query().Get("status")
	langFilter := r.URL.Query().Get("language")

	query := `SELECT id, user_id, username, language, content, status, created_at, COALESCE(reviewed_at,''), COALESCE(reviewed_by,0)
		FROM entries WHERE 1=1`
	args := []any{}

	if !isAdmin {
		query += " AND user_id = ?"
		args = append(args, claims.ID)
	}
	if statusFilter != "" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}
	if langFilter != "" {
		query += " AND language = ?"
		args = append(args, langFilter)
	}
	query += " ORDER BY id DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		writeError(w, 500, "Failed to fetch entries")
		return
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var e WordEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Username, &e.Language, &e.Content, &e.Status, &e.CreatedAt, &e.ReviewedAt, &e.ReviewedBy); err != nil {
			log.Printf("scan entry row: %v", err)
			continue
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []WordEntry{}
	}
	writeJSON(w, 200, map[string]any{"entries": entries})
}

func handleApprovedEntries(w http.ResponseWriter, r *http.Request) {
	lang := r.URL.Query().Get("language")
	if lang == "" {
		lang = "en"
	}
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	rows, err := db.Query(
		`SELECT id, user_id, username, language, content, status, created_at, COALESCE(reviewed_at,''), COALESCE(reviewed_by,0)
		 FROM entries WHERE status = 'approved' AND language = ? ORDER BY id DESC LIMIT ?`, lang, limit)
	if err != nil {
		writeError(w, 500, "Failed to fetch entries")
		return
	}
	defer rows.Close()

	var approved []WordEntry
	for rows.Next() {
		var e WordEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Username, &e.Language, &e.Content, &e.Status, &e.CreatedAt, &e.ReviewedAt, &e.ReviewedBy); err != nil {
			log.Printf("scan approved entry row: %v", err)
			continue
		}
		approved = append(approved, e)
	}
	if approved == nil {
		approved = []WordEntry{}
	}
	writeJSON(w, 200, map[string]any{"entries": approved})
}

func handleReviewEntry(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "admin:panel") {
		writeError(w, 403, "Insufficient permissions")
		return
	}

	entryID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, 400, "Invalid entry ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if body.Status != "approved" && body.Status != "rejected" {
		writeError(w, 400, "Status must be 'approved' or 'rejected'")
		return
	}

	reviewedAt := nowISO()
	res, err := db.Exec(
		"UPDATE entries SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?",
		body.Status, reviewedAt, claims.ID, entryID)
	if err != nil {
		writeError(w, 500, "Failed to update entry")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, 404, "Entry not found")
		return
	}

	// Return the updated entry
	row := db.QueryRow(
		`SELECT id, user_id, username, language, content, status, created_at, COALESCE(reviewed_at,''), COALESCE(reviewed_by,0)
		 FROM entries WHERE id = ?`, entryID)
	var e WordEntry
	if err := row.Scan(&e.ID, &e.UserID, &e.Username, &e.Language, &e.Content, &e.Status, &e.CreatedAt, &e.ReviewedAt, &e.ReviewedBy); err != nil {
		writeError(w, 500, "Entry updated but failed to read back")
		return
	}
	writeJSON(w, 200, map[string]any{"entry": e})
}

// ── SQLite NULL helpers ──

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullInt(n int) *int {
	if n == 0 {
		return nil
	}
	return &n
}
