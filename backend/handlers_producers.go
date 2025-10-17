package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// Helper function to calculate user's total production rate per second
func (s *Server) getUserProductionRate(userID string) (int, error) {
    producers, err := s.getUserProducers(userID)
    if err != nil {
        return 0, err
    }
    
    totalProduction := 0
    for _, producer := range producers {
        totalProduction += lineProduction(producer.Rate, producer.Owned)
    }
    return totalProduction, nil
}

// Helper function to get user's producers
func (s *Server) getUserProducers(userID string) ([]Producer, error) {
	producers := make([]Producer, len(defaultProducers))
	copy(producers, defaultProducers)
	
	now := time.Now().Unix()
	
	for i := range producers {
		owned, err := s.rdb.Get(ctx, "producer:"+userID+":"+strconv.Itoa(producers[i].ID)).Int()
		if err == nil {
			producers[i].Owned = owned
		}
		producers[i].Cost = calculateProducerCost(producers[i].Cost, producers[i].Owned)
		
		// Calculate build time for this producer (sync with purchase logic)
        if producers[i].Owned == 0 {
            // Only the first purchase has a delay: simple and readable
            producers[i].BuildTime = producers[i].ID + producers[i].Rate
        } else {
            // Subsequent purchases are instant
            producers[i].BuildTime = 0
        }
		
		// Check if this producer is currently building
		buildEndTime, err := s.rdb.Get(ctx, "producer_build_end:"+userID+":"+strconv.Itoa(producers[i].ID)).Int64()
		if err == nil && buildEndTime > now {
			producers[i].IsBuilding = true
			producers[i].BuildTimeLeft = buildEndTime - now
		} else {
			producers[i].IsBuilding = false
			producers[i].BuildTimeLeft = 0
		}
	}
	
	return producers, nil
}

// Helper function to calculate total production
func (s *Server) getTotalProduction(userID string) (int, error) {
    producers, err := s.getUserProducers(userID)
    if err != nil {
        return 0, err
    }
    
    total := 0
    for _, p := range producers {
        total += lineProduction(p.Rate, p.Owned)
    }
    return total, nil
}

func (s *Server) handleGetProducers(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	user := session.UserID
	
	producers, err := s.getUserProducers(user)
	if err != nil {
		http.Error(w, "failed to get producers", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(producers)
}

func (s *Server) handleBuyProducer(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	var req struct {
		ProducerID int `json:"producer_id"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ProducerID == 0 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	
	userID := session.UserID
	
	// Get current score (default to 10000 for brand new users)
	score, errScore := s.rdb.Get(ctx, userID).Int()
	if errScore != nil {
		score = 10000
	}
	
	// Get current producers
	producers, err := s.getUserProducers(userID)
	if err != nil {
		http.Error(w, "failed to get producers", http.StatusInternalServerError)
		return
	}
	
	// Find the producer
	var producer *Producer
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
	
	// Check if user has enough score
	if score < producer.Cost {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "insufficient score",
			"producers": producers,
			"score": score,
		})
		return
	}
	
	// Check if this producer is already building
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
	
	// Calculate build time for this producer (must match getUserProducers)
    var buildTime int
    if producer.Owned == 0 {
        // Only the first purchase has a delay: simple and predictable
        buildTime = producer.ID + producer.Rate
    } else {
        // Subsequent purchases are instant
        buildTime = 0
    }
	now := time.Now().Unix()
	
	// Deduct cost
	newScore := score - producer.Cost
	s.rdb.Set(ctx, userID, newScore, 0)
	
	// Update leaderboard
	s.rdb.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: userID})
	
	if buildTime == 0 {
		// Instant purchase - add producer immediately
		owned, err := s.rdb.Get(ctx, "producer:"+userID+":"+strconv.Itoa(req.ProducerID)).Int()
		if err != nil { owned = 0 }
		newOwned := owned + 1
		s.rdb.Set(ctx, "producer:"+userID+":"+strconv.Itoa(req.ProducerID), newOwned, 0)
		
		// Get updated producers
		updatedProducers, _ := s.getUserProducers(userID)
		
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"producers": updatedProducers,
			"score": newScore,
			"build_time": buildTime,
			"build_time_left": 0,
		})
	} else {
		// Delayed purchase - start building
		buildEndTime := now + int64(buildTime)
		s.rdb.Set(ctx, "producer_build_end:"+userID+":"+strconv.Itoa(req.ProducerID), buildEndTime, 0)
		
		// Get updated producers
		updatedProducers, _ := s.getUserProducers(userID)
		
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"producers": updatedProducers,
			"score": newScore,
			"build_time": buildTime,
			"build_time_left": buildTime,
		})
	}
}

func (s *Server) handleGetProduction(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	user := session.UserID
	
	production, err := s.getTotalProduction(user)
	if err != nil {
		http.Error(w, "failed to get production", http.StatusInternalServerError)
		return
	}
	
	json.NewEncoder(w).Encode(map[string]int{"production": production})
}
