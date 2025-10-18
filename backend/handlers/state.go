package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/redis/go-redis/v9"
	core "neon-clicker/core"
)

type State struct {
	RDB  *redis.Client
	Auth *Auth
}

func NewState(rdb *redis.Client, auth *Auth) *State { return &State{RDB: rdb, Auth: auth} }

func (s *State) HandleGetState(w http.ResponseWriter, r *http.Request) {
	session, err := s.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	user := session.UserID
	// Check if this is a new user (no score exists)
	exists, err := s.RDB.Exists(r.Context(), user).Result()
	if err != nil {
		http.Error(w, "redis error", 500)
		return
	}
	var score int
	if exists == 0 {
		// New user - return initial score and persist
		score = core.InitialScore
		s.RDB.Set(r.Context(), user, score, 0)
		s.RDB.ZAdd(r.Context(), "leaderboard", redis.Z{Score: float64(score), Member: user})
	} else {
		score, _ = s.RDB.Get(r.Context(), user).Int()
	}
	// Return session ID in header if this was a new session
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "tma ") || (user == "1234567" && authHeader == "") {
		sessionID, err := s.Auth.CreateSession(user, session.TelegramUser)
		if err == nil {
			w.Header().Set("X-Session-ID", sessionID)
		}
	}
	json.NewEncoder(w).Encode(map[string]int{"score": score})
}
