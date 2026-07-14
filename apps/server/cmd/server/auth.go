package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	PasswordHash string `json:"passwordHash"`
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

var users []User
var nextUserID = 1
var usersPath string

var emailRE = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
var usernameRE = regexp.MustCompile(`^[a-zA-Z0-9_]{3,20}$`)

func loadUsers() {
	usersPath = filepath.Join(dataDir, "users.json")
	readJSON(usersPath, &users)
	for _, u := range users {
		if u.ID >= nextUserID {
			nextUserID = u.ID + 1
		}
	}
}

func saveUsers() {
	writeJSONFile(usersPath, users)
}

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
	for _, u := range users {
		if u.Username == username {
			return UserPublic{}, "", errUserTaken
		}
		if u.Email == email {
			return UserPublic{}, "", errEmailTaken
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return UserPublic{}, "", err
	}

	role := RoleUser
	if len(users) == 0 {
		role = RoleDeveloper
	}

	u := User{
		ID:           nextUserID,
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
		CreatedAt:    timeNow(),
	}
	nextUserID++
	users = append(users, u)
	saveUsers()

	pub := toPublic(u)
	token := signToken(Claims{ID: pub.ID, Username: pub.Username, Role: string(pub.Role)})
	return pub, token, nil
}

func loginUser(identifier, password string) (UserPublic, string, error) {
	for _, u := range users {
		if u.Username == identifier || u.Email == identifier {
			if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
				return UserPublic{}, "", errInvalidCreds
			}
			pub := toPublic(u)
			token := signToken(Claims{ID: pub.ID, Username: pub.Username, Role: string(pub.Role)})
			return pub, token, nil
		}
	}
	return UserPublic{}, "", errInvalidCreds
}

func findUserByID(id int) *UserPublic {
	for _, u := range users {
		if u.ID == id {
			pub := toPublic(u)
			return &pub
		}
	}
	return nil
}

func updateUserRole(targetID int, newRole Role) *UserPublic {
	for i := range users {
		if users[i].ID == targetID {
			users[i].Role = newRole
			saveUsers()
			pub := toPublic(users[i])
			return &pub
		}
	}
	return nil
}

var errUserTaken = &appErr{"USERNAME_TAKEN"}
var errEmailTaken = &appErr{"EMAIL_TAKEN"}
var errInvalidCreds = &appErr{"INVALID_CREDENTIALS"}

type appErr struct{ msg string }

func (e *appErr) Error() string { return e.msg }

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
	pubUsers := make([]UserPublic, len(users))
	for i, u := range users {
		pubUsers[i] = toPublic(u)
	}
	writeJSON(w, 200, map[string]any{"users": pubUsers})
}

func handleUpdateRole(w http.ResponseWriter, r *http.Request) {
	claims := getAuthUser(r)
	if claims == nil || !hasPermission(Role(claims.Role), "roles:assign") {
		writeError(w, 403, "Insufficient permissions")
		return
	}

	idStr := r.PathValue("id")
	targetID, err := parseID(idStr)
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
