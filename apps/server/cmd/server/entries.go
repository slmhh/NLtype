package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
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

var entries []WordEntry
var nextEntryID = 1
var entriesPath string

func loadEntries() {
	entriesPath = filepath.Join(dataDir, "entries.json")
	readJSON(entriesPath, &entries)
	for _, e := range entries {
		if e.ID >= nextEntryID {
			nextEntryID = e.ID + 1
		}
	}
}

func saveEntries() {
	writeJSONFile(entriesPath, entries)
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
	if claims.Role == "developer" {
		status = "approved"
	}

	entry := WordEntry{
		ID:        nextEntryID,
		UserID:    claims.ID,
		Username:  claims.Username,
		Language:  body.Language,
		Content:   sanitized,
		Status:    status,
		CreatedAt: timeNow(),
	}
	nextEntryID++

	if status == "approved" {
		entry.ReviewedAt = timeNow()
		entry.ReviewedBy = claims.ID
	}

	entries = append([]WordEntry{entry}, entries...)
	saveEntries()

	writeJSON(w, 201, map[string]any{"entry": entry})
}

func handleListEntries(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	isAdmin := claims.Role == "admin" || claims.Role == "developer"

	var filtered []WordEntry
	for _, e := range entries {
		if !isAdmin && e.UserID != claims.ID {
			continue
		}
		if status := r.URL.Query().Get("status"); status != "" && e.Status != status {
			continue
		}
		if lang := r.URL.Query().Get("language"); lang != "" && e.Language != lang {
			continue
		}
		filtered = append(filtered, e)
	}
	if filtered == nil {
		filtered = []WordEntry{}
	}
	writeJSON(w, 200, map[string]any{"entries": filtered})
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

	var approved []WordEntry
	for _, e := range entries {
		if e.Status == "approved" && e.Language == lang {
			approved = append(approved, e)
			if len(approved) >= limit {
				break
			}
		}
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

	idStr := r.PathValue("id")
	entryID, err := parseID(idStr)
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

	for i := range entries {
		if entries[i].ID == entryID {
			entries[i].Status = body.Status
			entries[i].ReviewedAt = timeNow()
			entries[i].ReviewedBy = claims.ID
			saveEntries()
			writeJSON(w, 200, map[string]any{"entry": entries[i]})
			return
		}
	}
	writeError(w, 404, "Entry not found")
}
