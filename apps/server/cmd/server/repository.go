package main

import (
	"database/sql"
	"log"
	"time"
)

// ── Repository interfaces ──

type UserRepository interface {
	Create(username, email, passwordHash, role, createdAt string) (int, error)
	FindByID(id int) (*User, error)
	FindByUsernameOrEmail(identifier string) (*User, error)
	Count() int
	UpdatePassword(userID int, hash string) error
	UpdateRole(userID int, role Role) error
	ListAll() []User
	UpdateSettings(userID int, settings string) error
	GetSettings(userID int) (string, error)
	SetEmailVerified(userID int) error
}

type ResultRepository interface {
	Create(tx *sql.Tx, userID int, username, mode, language string, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec int, createdAt string) (int, error)
	CreateEvent(stmt *sql.Stmt, resultID, charIndex, latencyMs, isCorrect, elapsedMs int, expectedChar, typedChar string) error
	GetByUserID(userID int) ([]GameResult, error)
	GetPersonalBests(userID int) ([]PersonalBest, error)
	GetLeaderboard(where string, args []any, limit int) ([]LeaderboardEntry, error)
	GetStats(resultID int) (*sql.Rows, error)
	GetOwnerID(resultID int) (int, error)
	DeleteAll() error
}

type EntryRepository interface {
	Create(userID int, username, language, codeLang, content, status, createdAt, reviewedAt string, reviewedBy int) (int, error)
	List(userID int, isAdmin bool, statusFilter, langFilter, codeLangFilter string) ([]WordEntry, error)
	GetApproved(lang, codeLang string, limit int) ([]WordEntry, error)
	UpdateStatus(entryID int, status, reviewedAt string, reviewedBy int) (bool, error)
	GetByID(entryID int) (*WordEntry, error)
}

type DailyRepository interface {
	GetChallengeByDate(dateStr string) (*DailyChallenge, error)
	CreateChallenge(dateStr, text, createdAt string) (int, error)
	CreateAttempt(userID, challengeID, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec int, createdAt string) error
	GetAttemptCount(userID, challengeID int) (int, error)
	GetLeaderboard(dateStr string) ([]DailyAttemptEntry, error)
}

type TokenRepository interface {
	CreateResetToken(userID int, token, expiresAt, createdAt string) error
	ConsumeResetToken(token, now string) (int, int, error)
	CreateVerificationToken(userID int, token, expiresAt, createdAt string) error
	ConsumeVerificationToken(token, now string) (int, error)
	BlacklistToken(hash, expiresAt, createdAt string)
	IsBlacklisted(hash string) bool
}

// ── SQL Repository Implementation ──

type sqlUserRepo struct{}

func (r *sqlUserRepo) Create(username, email, passwordHash, role, createdAt string) (int, error) {
	var id int
	err := db.QueryRow(
		"INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
		username, email, passwordHash, role, createdAt,
	).Scan(&id)
	return id, err
}

func (r *sqlUserRepo) FindByID(id int) (*User, error) {
	var u User
	err := db.QueryRow(
		"SELECT id, username, email, password_hash, role, created_at FROM users WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *sqlUserRepo) FindByUsernameOrEmail(identifier string) (*User, error) {
	var u User
	err := db.QueryRow(
		"SELECT id, username, email, password_hash, role, created_at FROM users WHERE username = ? OR email = ?",
		identifier, identifier,
	).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *sqlUserRepo) Count() int {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	return count
}

func (r *sqlUserRepo) UpdatePassword(userID int, hash string) error {
	_, err := db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", hash, userID)
	return err
}

func (r *sqlUserRepo) UpdateRole(userID int, role Role) error {
	_, err := db.Exec("UPDATE users SET role = ? WHERE id = ?", string(role), userID)
	return err
}

func (r *sqlUserRepo) ListAll() []User {
	rows, err := db.Query("SELECT id, username, email, password_hash, role, created_at FROM users ORDER BY id")
	if err != nil {
		return nil
	}
	defer rows.Close()
	var result []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err != nil {
			continue
		}
		result = append(result, u)
	}
	return result
}

func (r *sqlUserRepo) UpdateSettings(userID int, settings string) error {
	_, err := db.Exec("UPDATE users SET settings = ? WHERE id = ?", settings, userID)
	return err
}

func (r *sqlUserRepo) GetSettings(userID int) (string, error) {
	var raw string
	err := db.QueryRow("SELECT settings FROM users WHERE id = ?", userID).Scan(&raw)
	return raw, err
}

func (r *sqlUserRepo) SetEmailVerified(userID int) error {
	_, err := db.Exec("UPDATE users SET email_verified = 1 WHERE id = ?", userID)
	return err
}

type sqlResultRepo struct{}

func (r *sqlResultRepo) Create(tx *sql.Tx, userID int, username, mode, language string, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec int, createdAt string) (int, error) {
	var id int
	err := tx.QueryRow(
		`INSERT INTO results (user_id, username, mode, language, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		userID, username, mode, language, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec, createdAt,
	).Scan(&id)
	return id, err
}

func (r *sqlResultRepo) CreateEvent(stmt *sql.Stmt, resultID, charIndex, latencyMs, isCorrect, elapsedMs int, expectedChar, typedChar string) error {
	_, err := stmt.Exec(resultID, charIndex, expectedChar, typedChar, latencyMs, isCorrect, elapsedMs)
	return err
}

func (r *sqlResultRepo) GetByUserID(userID int) ([]GameResult, error) {
	rows, err := db.Query(
		`SELECT id, user_id, username, mode, language, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at
		 FROM results WHERE user_id = ? ORDER BY id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var userResults []GameResult
	for rows.Next() {
		var r GameResult
		if err := rows.Scan(&r.ID, &r.UserID, &r.Username, &r.Mode, &r.Language,
			&r.WPM, &r.Accuracy, &r.CPM, &r.RawWPM, &r.CorrectCount, &r.IncorrectCount, &r.DurationSec, &r.CreatedAt); err != nil {
			log.Printf("scan result row: %v", err)
			continue
		}
		userResults = append(userResults, r)
	}
	return userResults, nil
}

func (r *sqlResultRepo) GetPersonalBests(userID int) ([]PersonalBest, error) {
	rows, err := db.Query(
		`SELECT mode, language, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at
		 FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY mode, language ORDER BY wpm DESC) as rn FROM results WHERE user_id = ?) ranked WHERE rn = 1 ORDER BY wpm DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var bests []PersonalBest
	for rows.Next() {
		var b PersonalBest
		if err := rows.Scan(&b.Mode, &b.Language, &b.WPM, &b.Accuracy, &b.CPM, &b.RawWPM,
			&b.CorrectCount, &b.IncorrectCount, &b.DurationSec, &b.CreatedAt); err != nil {
			continue
		}
		bests = append(bests, b)
	}
	return bests, nil
}

func (r *sqlResultRepo) GetLeaderboard(where string, args []any, limit int) ([]LeaderboardEntry, error) {
	query := `SELECT username, wpm, accuracy, mode, language, created_at FROM results WHERE 1=1` + where + ` ORDER BY wpm DESC LIMIT ?`
	args = append(args, limit)
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []LeaderboardEntry
	rank := 1
	for rows.Next() {
		var username, mode, lang, createdAt string
		var wpm, accuracy int
		if err := rows.Scan(&username, &wpm, &accuracy, &mode, &lang, &createdAt); err != nil {
			continue
		}
		entries = append(entries, LeaderboardEntry{Rank: rank, Username: username, WPM: wpm, Accuracy: accuracy, ModeLabel: modeLabel(mode), LangLabel: langLabel(lang), Date: createdAt[:10]})
		rank++
	}
	return entries, nil
}

func (r *sqlResultRepo) GetStats(resultID int) (*sql.Rows, error) {
	return db.Query(
		`SELECT char_index, expected_char, typed_char, latency_ms, is_correct, elapsed_ms
		 FROM typing_events WHERE result_id = ? ORDER BY char_index`, resultID)
}

func (r *sqlResultRepo) GetOwnerID(resultID int) (int, error) {
	var ownerID int
	err := db.QueryRow("SELECT user_id FROM results WHERE id = ?", resultID).Scan(&ownerID)
	return ownerID, err
}

func (r *sqlResultRepo) DeleteAll() error {
	_, err := db.Exec("DELETE FROM results")
	return err
}

type sqlEntryRepo struct{}

func (r *sqlEntryRepo) Create(userID int, username, language, codeLang, content, status, createdAt, reviewedAt string, reviewedBy int) (int, error) {
	var id int
	err := db.QueryRow(
		`INSERT INTO entries (user_id, username, language, code_lang, content, status, created_at, reviewed_at, reviewed_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
		userID, username, language, codeLang, content, status, createdAt, nullStr(reviewedAt), nullInt(reviewedBy),
	).Scan(&id)
	return id, err
}

func (r *sqlEntryRepo) List(userID int, isAdmin bool, statusFilter, langFilter, codeLangFilter string) ([]WordEntry, error) {
	query := `SELECT id, user_id, username, language, code_lang, content, status, created_at, COALESCE(reviewed_at,''), COALESCE(reviewed_by,0) FROM entries WHERE 1=1`
	args := []any{}
	if !isAdmin {
		query += " AND user_id = ?"
		args = append(args, userID)
	}
	if statusFilter != "" {
		query += " AND status = ?"
		args = append(args, statusFilter)
	}
	if langFilter != "" {
		query += " AND language = ?"
		args = append(args, langFilter)
	}
	if codeLangFilter != "" {
		query += " AND code_lang = ?"
		args = append(args, codeLangFilter)
	}
	query += " ORDER BY id DESC"
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []WordEntry
	for rows.Next() {
		var e WordEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Username, &e.Language, &e.CodeLang, &e.Content, &e.Status, &e.CreatedAt, &e.ReviewedAt, &e.ReviewedBy); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func (r *sqlEntryRepo) GetApproved(lang, codeLang string, limit int) ([]WordEntry, error) {
	query := `SELECT id, user_id, username, language, code_lang, content, status, created_at, COALESCE(reviewed_at,''), COALESCE(reviewed_by,0) FROM entries WHERE status = 'approved' AND language = ?`
	args := []any{lang}
	if codeLang != "" {
		query += " AND code_lang = ?"
		args = append(args, codeLang)
	}
	query += " ORDER BY id DESC LIMIT ?"
	args = append(args, limit)
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var approved []WordEntry
	for rows.Next() {
		var e WordEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Username, &e.Language, &e.CodeLang, &e.Content, &e.Status, &e.CreatedAt, &e.ReviewedAt, &e.ReviewedBy); err != nil {
			continue
		}
		approved = append(approved, e)
	}
	return approved, nil
}

func (r *sqlEntryRepo) UpdateStatus(entryID int, status, reviewedAt string, reviewedBy int) (bool, error) {
	res, err := db.Exec("UPDATE entries SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?", status, reviewedAt, reviewedBy, entryID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (r *sqlEntryRepo) GetByID(entryID int) (*WordEntry, error) {
	var e WordEntry
	err := db.QueryRow(
		`SELECT id, user_id, username, language, code_lang, content, status, created_at, COALESCE(reviewed_at,''), COALESCE(reviewed_by,0)
		 FROM entries WHERE id = ?`, entryID,
	).Scan(&e.ID, &e.UserID, &e.Username, &e.Language, &e.CodeLang, &e.Content, &e.Status, &e.CreatedAt, &e.ReviewedAt, &e.ReviewedBy)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

type sqlDailyRepo struct{}

type DailyChallenge struct {
	ID        int
	Date      string
	Text      string
	CreatedAt string
}

type DailyAttemptEntry struct {
	Rank           int
	Username       string
	WPM            int
	Accuracy       int
	CPM            int
	CorrectCount   int
	IncorrectCount int
	DurationSec    int
	Date           string
}

func (r *sqlDailyRepo) GetChallengeByDate(dateStr string) (*DailyChallenge, error) {
	var c DailyChallenge
	err := db.QueryRow("SELECT id, date, text, created_at FROM daily_challenges WHERE date = ?", dateStr).Scan(&c.ID, &c.Date, &c.Text, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *sqlDailyRepo) CreateChallenge(dateStr, text, createdAt string) (int, error) {
	res, err := db.Exec("INSERT INTO daily_challenges (date, text, created_at) VALUES (?, ?, ?)", dateStr, text, createdAt)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (r *sqlDailyRepo) CreateAttempt(userID, challengeID, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec int, createdAt string) error {
	_, err := db.Exec(
		`INSERT INTO daily_attempts (user_id, challenge_id, wpm, accuracy, cpm, raw_wpm, correct_count, incorrect_count, duration_sec, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		userID, challengeID, wpm, accuracy, cpm, rawWpm, correctCount, incorrectCount, durationSec, createdAt)
	return err
}

func (r *sqlDailyRepo) GetAttemptCount(userID, challengeID int) (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM daily_attempts WHERE user_id = ? AND challenge_id = ?", userID, challengeID).Scan(&count)
	return count, err
}

func (r *sqlDailyRepo) GetLeaderboard(dateStr string) ([]DailyAttemptEntry, error) {
	rows, err := db.Query(
		`SELECT a.wpm, a.accuracy, a.cpm, a.correct_count, a.incorrect_count, a.duration_sec, a.created_at, u.username
		 FROM daily_attempts a JOIN users u ON u.id = a.user_id JOIN daily_challenges c ON c.id = a.challenge_id
		 WHERE c.date = ? ORDER BY a.wpm DESC, a.accuracy DESC, a.duration_sec ASC`, dateStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []DailyAttemptEntry
	rank := 0
	for rows.Next() {
		var wpm, acc, cpm, correct, incorrect, dur int
		var created, username string
		if err := rows.Scan(&wpm, &acc, &cpm, &correct, &incorrect, &dur, &created, &username); err != nil {
			continue
		}
		rank++
		entries = append(entries, DailyAttemptEntry{Rank: rank, Username: username, WPM: wpm, Accuracy: acc, CPM: cpm, CorrectCount: correct, IncorrectCount: incorrect, DurationSec: dur, Date: created})
	}
	return entries, nil
}

type sqlTokenRepo struct{}

func (r *sqlTokenRepo) CreateResetToken(userID int, token, expiresAt, createdAt string) error {
	_, err := db.Exec("INSERT INTO password_reset_tokens (user_id, token, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)", userID, token, expiresAt, createdAt)
	return err
}

func (r *sqlTokenRepo) ConsumeResetToken(token, now string) (int, int, error) {
	var tokenID, userID int
	err := db.QueryRow(
		`SELECT id, user_id FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?`, token, now,
	).Scan(&tokenID, &userID)
	return tokenID, userID, err
}

func (r *sqlTokenRepo) CreateVerificationToken(userID int, token, expiresAt, createdAt string) error {
	_, err := db.Exec("INSERT INTO email_verification_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)", userID, token, expiresAt, createdAt)
	return err
}

func (r *sqlTokenRepo) ConsumeVerificationToken(token, now string) (int, error) {
	var userID int
	err := db.QueryRow(
		`SELECT user_id FROM email_verification_tokens WHERE token = ? AND expires_at > ?`, token, now,
	).Scan(&userID)
	return userID, err
}

func (r *sqlTokenRepo) BlacklistToken(hash, expiresAt, createdAt string) {
	db.Exec("INSERT OR IGNORE INTO token_blacklist (token_hash, expires_at, created_at) VALUES (?, ?, ?)", hash, expiresAt, createdAt)
}

func (r *sqlTokenRepo) IsBlacklisted(hash string) bool {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM token_blacklist WHERE token_hash = ?", hash).Scan(&count)
	return count > 0
}

// ── Repository instances (used by handlers) ──

var (
	usersRepo   UserRepository   = &sqlUserRepo{}
	resultsRepo ResultRepository = &sqlResultRepo{}
	entriesRepo EntryRepository  = &sqlEntryRepo{}
	dailyRepo   DailyRepository  = &sqlDailyRepo{}
	tokensRepo  TokenRepository  = &sqlTokenRepo{}
)
