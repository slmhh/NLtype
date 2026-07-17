package main

import (
	"encoding/json"
	"net/http"
)

var allowedSettingKeys = map[string]func(any) bool{
	"theme":            func(v any) bool { s, ok := v.(string); return ok && (s == "light" || s == "dark") },
	"soundEnabled":     func(v any) bool { _, ok := v.(bool); return ok },
	"soundVolume":      func(v any) bool { n, ok := v.(float64); return ok && n >= 0 && n <= 1 },
	"fontSize":         func(v any) bool { n, ok := v.(float64); return ok && n >= 12 && n <= 32 },
	"uiLang":           func(v any) bool { s, ok := v.(string); return ok && (s == "zh" || s == "en") },
	"keyboardLayout":   func(v any) bool { s, ok := v.(string); return ok && len(s) <= 20 },
	"showKeyHints":     func(v any) bool { _, ok := v.(bool); return ok },
}

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
	limitBody(r)
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

	// Validate each setting key and value
	for k, v := range body.Settings {
		validator, ok := allowedSettingKeys[k]
		if !ok {
			writeError(w, 400, "Unknown setting: "+k)
			return
		}
		if !validator(v) {
			writeError(w, 400, "Invalid value for setting: "+k)
			return
		}
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
