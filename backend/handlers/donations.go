package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	core "neon-clicker/core"
	"github.com/redis/go-redis/v9"
)

type Donations struct {
	RDB  *redis.Client
	Auth *Auth
}

func NewDonations(rdb *redis.Client, auth *Auth) *Donations { return &Donations{RDB: rdb, Auth: auth} }

func (d *Donations) getDonationTotals(ctx context.Context) (map[int]int64, error) {
	totals := make(map[int]int64)
	for _, g := range core.DonationGoals {
		v, err := d.RDB.Get(ctx, "donation_goal_total:"+strconv.Itoa(g.ID)).Int64()
		if err != nil {
			totals[g.ID] = 0
			continue
		}
		totals[g.ID] = v
	}
	return totals, nil
}

func (d *Donations) HandleListGoals(w http.ResponseWriter, r *http.Request) {
	_, err := d.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	ctx := context.Background()
	totals, _ := d.getDonationTotals(ctx)
	type Resp struct {
		ID int `json:"id"`
		Name string `json:"name"`
		Target int64 `json:"target"`
		TotalDonated int64 `json:"total_donated"`
		Percent float64 `json:"percent"`
	}
	var out []Resp
	for _, g := range core.DonationGoals {
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

func (d *Donations) HandleGetGoal(w http.ResponseWriter, r *http.Request) {
	session, err := d.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	ctx := context.Background()
	currentUserID := session.UserID
	idStr := r.URL.Query().Get("id")
	if idStr == "" { http.Error(w, "bad request", http.StatusBadRequest); return }
	id, err := strconv.Atoi(idStr)
	if err != nil { http.Error(w, "bad request", http.StatusBadRequest); return }
	var goal *core.DonationGoal
	for i := range core.DonationGoals {
		if core.DonationGoals[i].ID == id { goal = &core.DonationGoals[i]; break }
	}
	if goal == nil { http.Error(w, "not found", http.StatusNotFound); return }
	total, _ := d.RDB.Get(ctx, "donation_goal_total:"+strconv.Itoa(goal.ID)).Int64()
	p := 0.0
	if goal.Target > 0 { p = float64(total) / float64(goal.Target) * 100.0 }
	donors, _ := d.RDB.ZRevRangeWithScores(ctx, "donation_goal_donors:"+strconv.Itoa(goal.ID), 0, 9).Result()
	type Donor struct { UserID string `json:"user_id"`; Amount int64 `json:"amount"`; IsSelf bool `json:"is_self"` }
	var top []Donor
	for _, z := range donors {
		uid := z.Member.(string)
		top = append(top, Donor{UserID: core.MaskTelegramID(uid), Amount: int64(z.Score), IsSelf: uid == currentUserID})
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

func (d *Donations) HandleDonate(w http.ResponseWriter, r *http.Request) {
	session, err := d.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	ctx := context.Background()
	var req struct { GoalID int `json:"goal_id"`; Percent int `json:"percent"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.GoalID == 0 { http.Error(w, "bad request", http.StatusBadRequest); return }
	if req.Percent != 10 && req.Percent != 25 && req.Percent != 50 && req.Percent != 100 { http.Error(w, "bad request", http.StatusBadRequest); return }
	userID := session.UserID
	score, _ := d.RDB.Get(ctx, userID).Int()
	if score <= 0 { json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "insufficient score"}); return }
	amount := int64(score * req.Percent / 100)
	if amount <= 0 { json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "message": "insufficient score"}); return }
	newScore, err := d.RDB.DecrBy(ctx, userID, amount).Result()
	if err != nil { http.Error(w, "redis error", http.StatusInternalServerError); return }
	d.RDB.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: userID})
	goalKey := "donation_goal_total:" + strconv.Itoa(req.GoalID)
	donorsKey := "donation_goal_donors:" + strconv.Itoa(req.GoalID)
	total, _ := d.RDB.IncrBy(ctx, goalKey, amount).Result()
	d.RDB.ZIncrBy(ctx, donorsKey, float64(amount), userID)
	var goal *core.DonationGoal
	for i := range core.DonationGoals { if core.DonationGoals[i].ID == req.GoalID { goal = &core.DonationGoals[i]; break } }
	if goal == nil { http.Error(w, "not found", http.StatusNotFound); return }
	p := 0.0
	if goal.Target > 0 { p = float64(total) / float64(goal.Target) * 100.0 }
	donors, _ := d.RDB.ZRevRangeWithScores(ctx, donorsKey, 0, 9).Result()
	type Donor2 struct { UserID string `json:"user_id"`; Amount int64 `json:"amount"`; IsSelf bool `json:"is_self"` }
	var top []Donor2
	for _, z := range donors {
		uid := z.Member.(string)
		top = append(top, Donor2{UserID: core.MaskTelegramID(uid), Amount: int64(z.Score), IsSelf: uid == session.UserID})
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
