package main

import (
	"encoding/json"
	"net/http"
	"sort"
)

func (s *Server) handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	currentUserID := session.UserID
	
	results, err := s.rdb.ZRevRangeWithScores(ctx, "leaderboard", 0, 19).Result() // Top 20
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch leaderboard"})
		return
	}
	entries := make([]map[string]interface{}, len(results))
	for i, z := range results {
		userID := z.Member.(string)
		entries[i] = map[string]interface{}{
			"user_id": maskTelegramID(userID),
			"score": int64(z.Score),
			"is_self": userID == currentUserID,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (s *Server) handlePerSecondLeaderboard(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	currentUserID := session.UserID
	
	// Get all users from the main leaderboard
	results, err := s.rdb.ZRevRangeWithScores(ctx, "leaderboard", 0, -1).Result()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch leaderboard"})
		return
	}
	
	// Calculate production rate for each user and create entries
	var entries []map[string]interface{}
	for _, z := range results {
		userID := z.Member.(string)
		productionRate, err := s.getUserProductionRate(userID)
		if err != nil {
			continue // Skip users with errors
		}
		
		entries = append(entries, map[string]interface{}{
			"user_id": maskTelegramID(userID),
			"production_rate": productionRate,
			"is_self": userID == currentUserID,
		})
	}
	
	// Sort by production rate (descending)
	sort.Slice(entries, func(i, j int) bool {
		rateI := entries[i]["production_rate"].(int)
		rateJ := entries[j]["production_rate"].(int)
		return rateI > rateJ
	})
	
	// Limit to top 20
	if len(entries) > 20 {
		entries = entries[:20]
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (s *Server) handleClicksLeaderboard(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	currentUserID := session.UserID
	
	results, err := s.rdb.ZRevRangeWithScores(ctx, "clicks_leaderboard", 0, 19).Result() // Top 20
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch clicks leaderboard"})
		return
	}
	entries := make([]map[string]interface{}, len(results))
	for i, z := range results {
		userID := z.Member.(string)
		entries[i] = map[string]interface{}{
			"user_id": maskTelegramID(userID),
			"clicks": int64(z.Score),
			"is_self": userID == currentUserID,
		}
	}

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(entries)
}
