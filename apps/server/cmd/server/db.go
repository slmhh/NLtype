package main

import (
	"database/sql"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func initDB(dir string) error {
	path := filepath.Join(dir, "nltype.db")
	var err error
	db, err = sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(1)

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user',
		created_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		username TEXT NOT NULL,
		mode TEXT NOT NULL,
		language TEXT NOT NULL,
		wpm INTEGER NOT NULL,
		accuracy INTEGER NOT NULL,
		cpm INTEGER NOT NULL,
		raw_wpm INTEGER NOT NULL,
		correct_count INTEGER NOT NULL,
		incorrect_count INTEGER NOT NULL,
		duration_sec INTEGER NOT NULL,
		created_at TEXT NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);
	CREATE TABLE IF NOT EXISTS entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		username TEXT NOT NULL,
		language TEXT NOT NULL,
		content TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TEXT NOT NULL,
		reviewed_at TEXT,
		reviewed_by INTEGER,
		FOREIGN KEY (user_id) REFERENCES users(id),
		FOREIGN KEY (reviewed_by) REFERENCES users(id)
	);
	CREATE INDEX IF NOT EXISTS idx_results_user ON results(user_id);
	CREATE INDEX IF NOT EXISTS idx_results_wpm ON results(wpm DESC);
	CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
	CREATE INDEX IF NOT EXISTS idx_entries_lang ON entries(language);`

	_, err = db.Exec(schema)
	return err
}

func nowISO() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05Z")
}
