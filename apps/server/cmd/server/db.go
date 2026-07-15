package main

import (
	"database/sql"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var db *sql.DB

type migration struct {
	version int
	desc    string
	sql     string
}

var migrations = []migration{
	{
		version: 1,
		desc:    "initial schema",
		sql: `
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
			CREATE INDEX IF NOT EXISTS idx_entries_lang ON entries(language);`,
	},
	{
		version: 2,
		desc:    "add composite index for personal bests query",
		sql:     "CREATE INDEX IF NOT EXISTS idx_results_user_mode_lang ON results(user_id, mode, language)",
	},
	{
		version: 3,
		desc:    "add password_reset_tokens table and settings column",
		sql: `
			CREATE TABLE IF NOT EXISTS password_reset_tokens (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				token TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				used INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id)
			);
			ALTER TABLE users ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';`,
	},
}

func initDB(dir string) error {
	path := filepath.Join(dir, "nltype.db")
	var err error
	db, err = sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(1)

	return runMigrations()
}

func runMigrations() error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		applied_at TEXT NOT NULL
	)`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	var currentVersion int
	db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&currentVersion)

	for _, m := range migrations {
		if m.version <= currentVersion {
			continue
		}
		log.Printf("Applying migration %d: %s", m.version, m.desc)
		if _, err := db.Exec(m.sql); err != nil {
			// SQLite does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN
			if strings.Contains(err.Error(), "duplicate column") {
				log.Printf("Migration %d: column already exists, skipping", m.version)
			} else {
				return fmt.Errorf("migration %d (%s): %w", m.version, m.desc, err)
			}
		}
		now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
		if _, err := db.Exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", m.version, now); err != nil {
			return fmt.Errorf("record migration %d: %w", m.version, err)
		}
		log.Printf("Migration %d applied", m.version)
	}
	return nil
}

func nowISO() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05Z")
}
