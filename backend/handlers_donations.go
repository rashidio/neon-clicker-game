package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/redis/go-redis/v9"
)

func (s *Server) getDonationTotals() (map[int]int64, error) {
	totals := make(map[int]int64)
	for _, g := range donationGoals {
		v, err := s.rdb.Get(ctx, "donation_goal_total:"+strconv.Itoa(g.ID)).Int64()
		if err != nil {
			totals[g.ID] = 0
			continue
		}
		totals[g.ID] = v
	}
	return totals, nil
}

func (s *Server) handleListDonationGoals(w http.ResponseWriter, r *http.Request) {
	_, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	totals, _ := s.getDonationTotals()
	type Resp struct {
		ID int `json:"id"`
		Name string `json:"name"`
		Target int64 `json:"target"`
		TotalDonated int64 `json:"total_donated"`
		Percent float64 `json:"percent"`
	}
	var out []Resp
	for _, g := range donationGoals {
		td := totals[g.ID]
		p := 0.0
		if g.Target > 0 {
			p = float64(td) / float64(g.Target) * 100.0
		}
		out = append(out, Resp{ID: g.ID, Name: g.Name, Target: g.Target, TotalDonated: td, Percent: p})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func (s *Server) handleGetDonationGoal(w http.ResponseWriter, r *http.Request) {
	_, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	var goal *DonationGoal
	for i := range donationGoals {
		if donationGoals[i].ID == id {
			goal = &donationGoals[i]
			break
		}
	}
	if goal == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	total, _ := s.rdb.Get(ctx, "donation_goal_total:"+strconv.Itoa(goal.ID)).Int64()
	p := 0.0
	if goal.Target > 0 {
		p = float64(total) / float64(goal.Target) * 100.0
	}
	donors, _ := s.rdb.ZRevRangeWithScores(ctx, "donation_goal_donors:"+strconv.Itoa(goal.ID), 0, 9).Result()
	type Donor struct {
		UserID string `json:"user_id"`
		Amount int64 `json:"amount"`
	}
	var top []Donor
	for _, z := range donors {
		uid := z.Member.(string)
		top = append(top, Donor{UserID: maskTelegramID(uid), Amount: int64(z.Score)})
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": goal.ID,
		"name": goal.Name,
		"target": goal.Target,
		"total_donated": total,
		"percent": p,
		"top_donors": top,
	})
}

func (s *Server) handleDonate(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	var req struct {
		GoalID int `json:"goal_id"`
		Percent int `json:"percent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GoalID == 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Percent != 10 && req.Percent != 25 && req.Percent != 50 && req.Percent != 100 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	userID := session.UserID
	score, _ := s.rdb.Get(ctx, userID).Int()
	if score <= 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "insufficient score"})
		return
	}
	amount := int64(score * req.Percent / 100)
	if amount <= 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "insufficient score"})
		return
	}
	newScore, err := s.rdb.DecrBy(ctx, userID, amount).Result()
	if err != nil {
		http.Error(w, "redis error", http.StatusInternalServerError)
		return
	}
	s.rdb.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: userID})
	goalKey := "donation_goal_total:" + strconv.Itoa(req.GoalID)
	donorsKey := "donation_goal_donors:" + strconv.Itoa(req.GoalID)
	total, _ := s.rdb.IncrBy(ctx, goalKey, amount).Result()
	s.rdb.ZIncrBy(ctx, donorsKey, float64(amount), userID)
	var goal *DonationGoal
	for i := range donationGoals {
		if donationGoals[i].ID == req.GoalID {
			goal = &donationGoals[i]
			break
		}
	}
	if goal == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	p := 0.0
	if goal.Target > 0 {
		p = float64(total) / float64(goal.Target) * 100.0
	}
	donors, _ := s.rdb.ZRevRangeWithScores(ctx, donorsKey, 0, 9).Result()
	type Donor2 struct {
		UserID string `json:"user_id"`
		Amount int64 `json:"amount"`
	}
	var top []Donor2
	for _, z := range donors {
		uid := z.Member.(string)
		top = append(top, Donor2{UserID: maskTelegramID(uid), Amount: int64(z.Score)})
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"score": int(newScore),
		"goal": map[string]interface{}{
			"id": goal.ID,
			"name": goal.Name,
			"target": goal.Target,
			"total_donated": total,
			"percent": p,
			"top_donors": top,
		},
	})
}
