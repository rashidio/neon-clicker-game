package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	core "neon-clicker/core"
	handlers "neon-clicker/handlers"
)

var ctx = context.Background()

type Server struct {
	rdb *redis.Client
	botToken string
	auth *handlers.Auth
	prod *handlers.Producers
}

func NewServer(addr string) *Server {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	a := handlers.NewAuth(rdb, botToken)
	return &Server{rdb: rdb, botToken: botToken, auth: a}
}

func (s *Server) handleGetState(w http.ResponseWriter, r *http.Request) {
	session, err := s.auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	user := session.UserID
	
	// Check if this is a new user (no score exists)
	exists, err := s.rdb.Exists(ctx, user).Result()
	if err != nil {
		http.Error(w, "redis error", 500)
		return
	}
	
	var score int
	if exists == 0 {
		// New user - return 10000 initial score
		score = 10000
		// Persist initial score so other endpoints (e.g., buy_producer) see it
		s.rdb.Set(ctx, user, score, 0)
		// Seed leaderboard with initial score
		s.rdb.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(score), Member: user})
	} else {
		// Existing user - get their actual score
		score, _ = s.rdb.Get(ctx, user).Int()
	}
	
	// Return session ID in header if this was a new session
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "tma ") || (user == "1234567" && authHeader == "") {
		// This was a new session, return the session ID
		sessionID, err := s.auth.CreateSession(user, session.TelegramUser)
		if err == nil {
			w.Header().Set("X-Session-ID", sessionID)
		}
	}
	
	json.NewEncoder(w).Encode(map[string]int{"score": score})
}

// handleUpgradePower moved to handlers_upgrades.go

// handleClick moved to handlers_upgrades.go

// handleGetProducers moved to handlers_producers.go

// handleBuyProducer moved to handlers_producers.go

// handleGetProduction moved to handlers_producers.go

// getDonationTotals moved to handlers_donations.go

// handleListDonationGoals moved to handlers_donations.go

// handleGetDonationGoal moved to handlers_donations.go

// handleDonate moved to handlers_donations.go

// Background production system
func (s *Server) startBackgroundProduction() {
	ticker := time.NewTicker(1 * time.Second) // Update every second
	go func() {
		for range ticker.C {
			// Get all users from leaderboard
			users, err := s.rdb.ZRevRange(ctx, "leaderboard", 0, -1).Result()
			if err != nil {
				continue
			}
			
			for _, userID := range users {
				// Check for completed power upgrades
				s.checkAndCompletePowerUpgrade(userID)
				
				// Check for completed producer builds
				s.checkAndCompleteProducerBuilds(userID)
				
				// Get user's production via producers helper
				production, err := s.prod.GetTotalProduction(userID)
				if err != nil || production == 0 {
					continue
				}
				
				// Add production to score
				score, err := s.rdb.Get(ctx, userID).Int()
				if err != nil {
					continue
				}
				
				newScore := score + production
				s.rdb.Set(ctx, userID, newScore, 0)
				s.rdb.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: userID})
			}
		}
	}()
}

// Check and complete power upgrades that have finished building
func (s *Server) checkAndCompletePowerUpgrade(userID string) {
	buildEndTime, err := s.rdb.Get(ctx, "power_build_end:"+userID).Int64()
	if err != nil {
		return // No build in progress
	}
	
	now := time.Now().Unix()
	if buildEndTime <= now {
		// Build is complete, apply the upgrade
		power, err1 := s.rdb.Get(ctx, "power:"+userID).Int()
		if err1 != nil { power = 1 }
		price, err2 := s.rdb.Get(ctx, "power_price:"+userID).Int()
		if err2 != nil { price = 10 }
		
		// Apply the upgrade
		newPower := core.CalculateNextPower(power)
		newPrice := core.CalculateNextPowerPrice(price)
		
		s.rdb.Set(ctx, "power:"+userID, newPower, 0)
		s.rdb.Set(ctx, "power_price:"+userID, newPrice, 0)
		s.rdb.Del(ctx, "power_build_end:"+userID) // Remove build timer
	}
}

// Check and complete producer builds that have finished building
func (s *Server) checkAndCompleteProducerBuilds(userID string) {
	now := time.Now().Unix()
	
	// Check all producers for completed builds
	for _, producer := range core.DefaultProducers {
		buildEndTime, err := s.rdb.Get(ctx, "producer_build_end:"+userID+":"+strconv.Itoa(producer.ID)).Int64()
		if err != nil {
			continue // No build in progress for this producer
		}
		
		if buildEndTime <= now {
			// Build is complete, add the producer
			owned, err := s.rdb.Get(ctx, "producer:"+userID+":"+strconv.Itoa(producer.ID)).Int()
			if err != nil { owned = 0 }
			
			newOwned := owned + 1
			s.rdb.Set(ctx, "producer:"+userID+":"+strconv.Itoa(producer.ID), newOwned, 0)
			s.rdb.Del(ctx, "producer_build_end:"+userID+":"+strconv.Itoa(producer.ID)) // Remove build timer
		}
	}
}

func main() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	s := NewServer(addr)
	p := handlers.NewProducers(s.rdb, s.auth)
	u := handlers.NewUpgrades(s.rdb, s.auth)
	st := handlers.NewState(s.rdb, s.auth)
	lb := handlers.NewLeaderboard(s.rdb, s.auth, p)
	d := handlers.NewDonations(s.rdb, s.auth)
	
	// Attach producers helper to server and start background production
	s.prod = p
	s.startBackgroundProduction()

	http.HandleFunc("/api/state", st.HandleGetState)
	http.HandleFunc("/api/click", u.HandleClick)
	http.HandleFunc("/api/leaderboard", lb.HandleLeaderboard)
	http.HandleFunc("/api/per_second_leaderboard", lb.HandlePerSecond)
	http.HandleFunc("/api/clicks_leaderboard", lb.HandleClicks)
	http.HandleFunc("/api/user_upgrades", u.HandleGetUpgrades)
	http.HandleFunc("/api/upgrade_power", u.HandleUpgradePower)
	http.HandleFunc("/api/producers", p.HandleGetProducers)
	http.HandleFunc("/api/buy_producer", p.HandleBuyProducer)
	http.HandleFunc("/api/production", p.HandleGetProduction)
	http.HandleFunc("/api/donations/goals", d.HandleListGoals)
	http.HandleFunc("/api/donations/goal", d.HandleGetGoal)
	http.HandleFunc("/api/donations/donate", d.HandleDonate)

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
