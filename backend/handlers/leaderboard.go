package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"

	core "neon-clicker/core"
	"github.com/redis/go-redis/v9"
)

type Leaderboard struct {
	RDB  *redis.Client
	Auth *Auth
	Prod *Producers
}

func NewLeaderboard(rdb *redis.Client, auth *Auth, prod *Producers) *Leaderboard { return &Leaderboard{RDB: rdb, Auth: auth, Prod: prod} }

func (h *Leaderboard) HandleLeaderboard(w http.ResponseWriter, r *http.Request) {
	session, err := h.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	currentUserID := session.UserID
	ctx := context.Background()
	results, err := h.RDB.ZRevRangeWithScores(ctx, "leaderboard", 0, 19).Result()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch leaderboard"})
		return
	}
	var entries []map[string]interface{}
	for _, z := range results {
		userID := z.Member.(string)
		entries = append(entries, map[string]interface{}{
			"user_id": core.MaskTelegramID(userID),
			"score": int64(z.Score),
			"is_self": userID == currentUserID,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (h *Leaderboard) HandlePerSecond(w http.ResponseWriter, r *http.Request) {
	session, err := h.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	currentUserID := session.UserID
	ctx := context.Background()
	results, err := h.RDB.ZRevRangeWithScores(ctx, "leaderboard", 0, -1).Result()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch leaderboard"})
		return
	}
	var entries []map[string]interface{}
	for _, z := range results {
		userID := z.Member.(string)
		rate, err := h.Prod.GetUserProductionRate(userID)
		if err != nil { rate = 0 }
		entries = append(entries, map[string]interface{}{
			"user_id": core.MaskTelegramID(userID),
			"production_rate": rate,
			"is_self": userID == currentUserID,
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		ri := entries[i]["production_rate"].(int)
		rj := entries[j]["production_rate"].(int)
		return ri > rj
	})
	if len(entries) > 20 { entries = entries[:20] }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (h *Leaderboard) HandleClicks(w http.ResponseWriter, r *http.Request) {
	session, err := h.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	currentUserID := session.UserID
	ctx := context.Background()
	results, err := h.RDB.ZRevRangeWithScores(ctx, "clicks_leaderboard", 0, 19).Result()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch clicks leaderboard"})
		return
	}
	entries := make([]map[string]interface{}, len(results))
	for i, z := range results {
		userID := z.Member.(string)
		entries[i] = map[string]interface{}{
			"user_id": core.MaskTelegramID(userID),
			"clicks": int64(z.Score),
			"is_self": userID == currentUserID,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}
