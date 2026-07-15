package main

import (
	"encoding/json"
	"net/http"
)

func handleGetSettings(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	var raw string
	err := db.QueryRow("SELECT settings FROM users WHERE id = ?", claims.ID).Scan(&raw)
	if err != nil {
		writeError(w, 500, "Failed to load settings")
		return
	}

	var settings map[string]any
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		settings = map[string]any{}
	}

	writeJSON(w, 200, map[string]any{"settings": settings})
}

func handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Authentication required")
		return
	}

	var body struct {
		Settings map[string]any `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if body.Settings == nil {
		writeError(w, 400, "Settings object is required")
		return
	}

	// Merge with existing settings
	var raw string
	db.QueryRow("SELECT settings FROM users WHERE id = ?", claims.ID).Scan(&raw)
	var existing map[string]any
	json.Unmarshal([]byte(raw), &existing)
	if existing == nil {
		existing = make(map[string]any)
	}
	for k, v := range body.Settings {
		existing[k] = v
	}

	merged, err := json.Marshal(existing)
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}

	_, err = db.Exec("UPDATE users SET settings = ? WHERE id = ?", string(merged), claims.ID)
	if err != nil {
		writeError(w, 500, "Failed to save settings")
		return
	}

	writeJSON(w, 200, map[string]any{"settings": existing})
}
