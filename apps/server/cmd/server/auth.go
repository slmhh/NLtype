package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Role         Role   `json:"role"`
	CreatedAt    string `json:"createdAt"`
}

type UserPublic struct {
	ID          int      `json:"id"`
	Username    string   `json:"username"`
	Email       string   `json:"email"`
	Role        Role     `json:"role"`
	Permissions []string `json:"permissions"`
	CreatedAt   string   `json:"createdAt"`
}

var emailRE = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
var usernameRE = regexp.MustCompile(`^[a-zA-Z0-9_]{3,20}$`)

func toPublic(u User) UserPublic {
	return UserPublic{
		ID:          u.ID,
		Username:    u.Username,
		Email:       u.Email,
		Role:        u.Role,
		Permissions: rolePermissions[u.Role],
		CreatedAt:   u.CreatedAt,
	}
}

func registerUser(username, email, password string) (UserPublic, string, error) {
	var count int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)

	role := RoleUser
	if count == 0 {
		role = RoleDeveloper
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return UserPublic{}, "", err
	}

	var id int
	created := nowISO()
	err = db.QueryRow(
		"INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
		username, email, string(hash), string(role), created,
	).Scan(&id)
	if err != nil {
		if isUniqueErr(err) {
			dup := duplicateField(err, username, email)
			return UserPublic{}, "", dup
		}
		return UserPublic{}, "", err
	}

	pub := UserPublic{
		ID:          id,
		Username:    username,
		Email:       email,
		Role:        role,
		Permissions: rolePermissions[role],
		CreatedAt:   created,
	}
	token := signToken(Claims{ID: pub.ID, Username: pub.Username, Role: string(pub.Role)})
	return pub, token, nil
}

func loginUser(identifier, password string) (UserPublic, string, error) {
	var u User
	err := db.QueryRow(
		"SELECT id, username, email, password_hash, role, created_at FROM users WHERE username = ? OR email = ?",
		identifier, identifier,
	).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return UserPublic{}, "", errInvalidCreds
	}
	if err != nil {
		return UserPublic{}, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return UserPublic{}, "", errInvalidCreds
	}

	pub := toPublic(u)
	token := signToken(Claims{ID: pub.ID, Username: pub.Username, Role: string(pub.Role)})
	return pub, token, nil
}

func findUserByID(id int) *UserPublic {
	var u User
	err := db.QueryRow(
		"SELECT id, username, email, password_hash, role, created_at FROM users WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err != nil {
		return nil
	}
	pub := toPublic(u)
	return &pub
}

func updateUserRole(targetID int, newRole Role) *UserPublic {
	_, err := db.Exec("UPDATE users SET role = ? WHERE id = ?", string(newRole), targetID)
	if err != nil {
		return nil
	}
	return findUserByID(targetID)
}

func listAllUsers() []UserPublic {
	rows, err := db.Query("SELECT id, username, email, role, created_at FROM users ORDER BY id")
	if err != nil {
		return nil
	}
	defer rows.Close()

	var result []UserPublic
	for rows.Next() {
		var u UserPublic
		var roleStr string
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &roleStr, &u.CreatedAt); err != nil {
			continue
		}
		u.Role = Role(roleStr)
		u.Permissions = rolePermissions[u.Role]
		result = append(result, u)
	}
	if result == nil {
		result = []UserPublic{}
	}
	return result
}

// ── Unique constraint helpers ──

func isUniqueErr(err error) bool {
	return err != nil && (contains(err.Error(), "UNIQUE") || contains(err.Error(), "unique"))
}

func duplicateField(err error, username, email string) error {
	if contains(err.Error(), "username") {
		return errUserTaken
	}
	return errEmailTaken
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && (s[:len(sub)] == sub || contains(s[1:], sub)))
}

var errUserTaken = &appErr{"USERNAME_TAKEN"}
var errEmailTaken = &appErr{"EMAIL_TAKEN"}
var errInvalidCreds = &appErr{"INVALID_CREDENTIALS"}

type appErr struct{ msg string }

func (e *appErr) Error() string { return e.msg }

// ── Handlers ──

func handleRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}

	if body.Username == "" || body.Email == "" || body.Password == "" {
		writeError(w, 400, "Missing fields")
		return
	}
	if !usernameRE.MatchString(body.Username) {
		writeError(w, 400, "Username must be 3-20 alphanumeric characters")
		return
	}
	if !emailRE.MatchString(body.Email) {
		writeError(w, 400, "Invalid email")
		return
	}
	if len(body.Password) < 8 {
		writeError(w, 400, "Password must be at least 8 characters")
		return
	}

	pub, token, err := registerUser(body.Username, body.Email, body.Password)
	if err == errUserTaken {
		writeError(w, 409, "Username already taken")
		return
	}
	if err == errEmailTaken {
		writeError(w, 409, "Email already taken")
		return
	}
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}
	writeJSON(w, 201, map[string]any{"user": pub, "token": token})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}
	if body.Identifier == "" || body.Password == "" {
		writeError(w, 400, "Missing fields")
		return
	}

	pub, token, err := loginUser(body.Identifier, body.Password)
	if err == errInvalidCreds {
		writeError(w, 401, "Invalid username/email or password")
		return
	}
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}
	writeJSON(w, 200, map[string]any{"user": pub, "token": token})
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil {
		writeError(w, 401, "Missing or invalid token")
		return
	}
	user := findUserByID(claims.ID)
	if user == nil {
		writeError(w, 404, "User not found")
		return
	}
	writeJSON(w, 200, map[string]any{"user": user})
}

func handleListUsers(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "users:view") {
		writeError(w, 403, "Insufficient permissions")
		return
	}
	writeJSON(w, 200, map[string]any{"users": listAllUsers()})
}

func handleUpdateRole(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "roles:assign") {
		writeError(w, 403, "Insufficient permissions")
		return
	}

	targetID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, 400, "Invalid user ID")
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, 400, "Invalid request body")
		return
	}

	validRoles := map[string]Role{"user": RoleUser, "admin": RoleAdmin, "developer": RoleDeveloper}
	newRole, ok := validRoles[body.Role]
	if !ok {
		writeError(w, 400, "Invalid role")
		return
	}

	updated := updateUserRole(targetID, newRole)
	if updated == nil {
		writeError(w, 404, "User not found")
		return
	}
	writeJSON(w, 200, map[string]any{"user": updated})
}
