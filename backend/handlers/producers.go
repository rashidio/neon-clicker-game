package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	core "neon-clicker/core"
	"github.com/redis/go-redis/v9"
)

type Producers struct {
	RDB  *redis.Client
	Auth *Auth
}

func NewProducers(rdb *redis.Client, auth *Auth) *Producers {
	return &Producers{RDB: rdb, Auth: auth}
}

// GetUserProductionRate calculates user's total production rate per second
func (p *Producers) GetUserProductionRate(userID string) (int, error) {
	producers, err := p.GetUserProducers(userID)
	if err != nil {
		return 0, err
	}
	totalProduction := 0
	for _, producer := range producers {
		totalProduction += core.LineProduction(producer.Rate, producer.Owned)
	}
	return totalProduction, nil
}

// GetUserProducers returns user's producers enriched with owned counts, costs, and build times
func (p *Producers) GetUserProducers(userID string) ([]core.Producer, error) {
	producers := make([]core.Producer, len(core.DefaultProducers))
	copy(producers, core.DefaultProducers)

	now := time.Now().Unix()
	ctx := context.Background()
	for i := range producers {
		owned, err := p.RDB.Get(ctx, "producer:"+userID+":"+strconv.Itoa(producers[i].ID)).Int()
		if err == nil {
			producers[i].Owned = owned
		}
		producers[i].Cost = core.CalculateProducerCost(producers[i].Cost, producers[i].Owned)
		if producers[i].Owned == 0 {
			producers[i].BuildTime = producers[i].ID + producers[i].Rate
		} else {
			producers[i].BuildTime = 0
		}
		buildEnd, err := p.RDB.Get(ctx, "producer_build_end:"+userID+":"+strconv.Itoa(producers[i].ID)).Int64()
		if err == nil && buildEnd > now {
			producers[i].IsBuilding = true
			producers[i].BuildTimeLeft = buildEnd - now
		} else {
			producers[i].IsBuilding = false
			producers[i].BuildTimeLeft = 0
		}
	}
	return producers, nil
}

// GetTotalProduction calculates total production for a user
func (p *Producers) GetTotalProduction(userID string) (int, error) {
	producers, err := p.GetUserProducers(userID)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, pr := range producers {
		total += core.LineProduction(pr.Rate, pr.Owned)
	}
	return total, nil
}

// HTTP handlers
func (p *Producers) HandleGetProducers(w http.ResponseWriter, r *http.Request) {
	session, err := p.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	user := session.UserID
	producers, err := p.GetUserProducers(user)
	if err != nil {
		http.Error(w, "failed to get producers", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(producers)
}

func (p *Producers) HandleBuyProducer(w http.ResponseWriter, r *http.Request) {
	session, err := p.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	var req struct { ProducerID int `json:"producer_id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ProducerID == 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	userID := session.UserID
	ctx := context.Background()
	// Get current score (default to 10000 for brand new users)
	score, errScore := p.RDB.Get(ctx, userID).Int()
	if errScore != nil { score = 10000 }
	// Get current producers
	producers, err := p.GetUserProducers(userID)
	if err != nil {
		http.Error(w, "failed to get producers", http.StatusInternalServerError)
		return
	}
	// Find producer
	var producer *core.Producer
	for i := range producers {
		if producers[i].ID == req.ProducerID {
			producer = &producers[i]
			break
		}
	}
	if producer == nil {
		http.Error(w, "producer not found", http.StatusBadRequest)
		return
	}
	if score < producer.Cost {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "insufficient score",
			"producers": producers,
			"score": score,
		})
		return
	}
	// Check if building
	if producer.IsBuilding {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "producer building in progress",
			"producers": producers,
			"score": score,
			"build_time_left": producer.BuildTimeLeft,
		})
		return
	}
	// Determine build time for this producer
	var buildTime int
	if producer.Owned == 0 {
		buildTime = producer.ID + producer.Rate
	} else {
		buildTime = 0
	}
	now := time.Now().Unix()
	// Deduct cost
	newScore := score - producer.Cost
	p.RDB.Set(ctx, userID, newScore, 0)
	// Update leaderboard
	p.RDB.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: userID})
	if buildTime == 0 {
		// Instant purchase
		owned, err := p.RDB.Get(ctx, "producer:"+userID+":"+strconv.Itoa(req.ProducerID)).Int()
		if err != nil { owned = 0 }
		newOwned := owned + 1
		p.RDB.Set(ctx, "producer:"+userID+":"+strconv.Itoa(req.ProducerID), newOwned, 0)
		updated, _ := p.GetUserProducers(userID)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"producers": updated,
			"score": newScore,
			"build_time": buildTime,
			"build_time_left": 0,
		})
		return
	}
	// Delayed purchase
	buildEnd := now + int64(buildTime)
	p.RDB.Set(ctx, "producer_build_end:"+userID+":"+strconv.Itoa(req.ProducerID), buildEnd, 0)
	updated, _ := p.GetUserProducers(userID)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"producers": updated,
		"score": newScore,
		"build_time": buildTime,
		"build_time_left": buildTime,
	})
}

func (p *Producers) HandleGetProduction(w http.ResponseWriter, r *http.Request) {
	session, err := p.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	user := session.UserID
	production, err := p.GetTotalProduction(user)
	if err != nil {
		http.Error(w, "failed to get production", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]int{"production": production})
}
