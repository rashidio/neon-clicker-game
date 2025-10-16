package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	initdata "github.com/telegram-mini-apps/init-data-golang"
)

var ctx = context.Background()

type Server struct {
	rdb *redis.Client
	botToken string
}

type DonationGoal struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
    Target int64 `json:"target"`
}

var donationGoals = []DonationGoal{
    {ID: 1, Name: "Pay US Debt", Target: 32000000000000},
    {ID: 2, Name: "Cleanup Oceans", Target: 92000000000000},
    {ID: 3, Name: "End Global Hunger", Target: 350000000000000},
    {ID: 4, Name: "Terraform Mars", Target: 1500000000000000},
    {ID: 5, Name: "Build Dyson Sphere", Target: 5000000000000000},
    {ID: 6, Name: "Interstellar Highway", Target: 12000000000000000},
}

type TelegramUser struct {
	ID int `json:"id"`
	FirstName string `json:"first_name"`
	LastName string `json:"last_name,omitempty"`
	Username string `json:"username,omitempty"`
	LanguageCode string `json:"language_code,omitempty"`
	IsPremium bool `json:"is_premium,omitempty"`
}

type Session struct {
	UserID string `json:"user_id"`
	TelegramUser *TelegramUser `json:"telegram_user,omitempty"`
	CreatedAt int64 `json:"created_at"`
	ExpiresAt int64 `json:"expires_at"`
}

type Producer struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Cost         int    `json:"cost"`
	Rate         int    `json:"rate"`
	Owned        int    `json:"owned"`
	Emoji        string `json:"emoji"`
	BuildTime    int    `json:"build_time"`
	IsBuilding   bool   `json:"is_building"`
	BuildTimeLeft int64 `json:"build_time_left"`
}

// Neon Sign Production Supply Chain - From raw materials to global distribution
var defaultProducers = []Producer{
	// Phase 1: Raw Material Extraction (1-20/sec)
	{ID: 1, Name: "Glass Quarry", Cost: 15, Rate: 1, Owned: 0, Emoji: "🏔️"},
	{ID: 2, Name: "Gas Extractor", Cost: 35, Rate: 2, Owned: 0, Emoji: "⛽"},
	{ID: 3, Name: "Metal Mine", Cost: 70, Rate: 3, Owned: 0, Emoji: "⛏️"},
	
	// Phase 2: Tube Manufacturing (20-100/sec)
	{ID: 4, Name: "Glass Blower", Cost: 150, Rate: 5, Owned: 0, Emoji: "🔥"},
	{ID: 5, Name: "Tube Bender", Cost: 300, Rate: 10, Owned: 0, Emoji: "🔧"},
	{ID: 6, Name: "Electrode Installer", Cost: 800, Rate: 15, Owned: 0, Emoji: "⚡"},
	
	// Phase 3: LED Sign Production (100-500/sec)
	{ID: 7, Name: "LED Factory", Cost: 1200, Rate: 30, Owned: 0, Emoji: "💡"},
	{ID: 8, Name: "Circuit Printer", Cost: 2400, Rate: 60, Owned: 0, Emoji: "🔌"},
	{ID: 9, Name: "Sign Assembler", Cost: 4800, Rate: 90, Owned: 0, Emoji: "🔨"},
	
	// Phase 4: Neon Sign Crafting (500-1500/sec)
	{ID: 10, Name: "Neon Bender", Cost: 9000, Rate: 150, Owned: 0, Emoji: "🌈"},
	{ID: 11, Name: "Gas Filler", Cost: 18000, Rate: 300, Owned: 0, Emoji: "💨"},
	{ID: 12, Name: "Quality Tester", Cost: 36000, Rate: 500, Owned: 0, Emoji: "🔍"},
	
	// Phase 5: Global Distribution (1500-5000/sec)
	{ID: 13, Name: "Shipping Container", Cost: 144000, Rate: 1800, Owned: 0, Emoji: "📦"},
	{ID: 14, Name: "Cargo Ship", Cost: 288000, Rate: 3000, Owned: 0, Emoji: "🚢"},
	{ID: 15, Name: "Global Neon Empire", Cost: 512000, Rate: 5000, Owned: 0, Emoji: "🌍"},
	
	// Phase 6: Mega Production (5000-15000/sec)
	{ID: 16, Name: "Neon Megafactory", Cost: 1000000, Rate: 8000, Owned: 0, Emoji: "🏭"},
	{ID: 17, Name: "Quantum Assembly Line", Cost: 5000000, Rate: 12000, Owned: 0, Emoji: "⚛️"},
	{ID: 18, Name: "Plasma Processing Plant", Cost: 10000000, Rate: 15000, Owned: 0, Emoji: "💥"},
	
	// Phase 7: Ultra Production (15000-50000/sec)
	{ID: 19, Name: "Neon Overdrive Complex", Cost: 50000000, Rate: 25000, Owned: 0, Emoji: "🚀"},
	{ID: 20, Name: "Cosmic Manufacturing Hub", Cost: 100000000, Rate: 35000, Owned: 0, Emoji: "🌌"},
	{ID: 21, Name: "Galactic Neon Station", Cost: 500000000, Rate: 50000, Owned: 0, Emoji: "🛸"},
	
	// Phase 8: Ultimate Production (50000-150000/sec)
	{ID: 22, Name: "Universal Neon Matrix", Cost: 1000000000, Rate: 75000, Owned: 0, Emoji: "🌐"},
	{ID: 23, Name: "Dimensional Neon Forge", Cost: 5000000000, Rate: 100000, Owned: 0, Emoji: "🌀"},
	{ID: 24, Name: "Reality Neon Engine", Cost: 10000000000, Rate: 125000, Owned: 0, Emoji: "🔮"},
	{ID: 25, Name: "Infinite Neon Generator", Cost: 50000000000, Rate: 150000, Owned: 0, Emoji: "♾️"},
}

func NewServer(addr string) *Server {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	return &Server{rdb: rdb, botToken: botToken}
}

// Telegram authentication functions using official library
func (s *Server) validateTelegramInitData(initDataRaw string) (*TelegramUser, error) {
	// For development/testing, allow validation without bot token
	if s.botToken == "" {
		fmt.Println("WARNING: Bot token not configured, skipping HMAC validation")
		// Parse init data without validation for development
		parsedData, err := initdata.Parse(initDataRaw)
		if err != nil {
			return nil, fmt.Errorf("failed to parse init data: %v", err)
		}
		
		// Convert to our TelegramUser struct
		telegramUser := &TelegramUser{
			ID:           int(parsedData.User.ID),
			FirstName:    parsedData.User.FirstName,
			LastName:     parsedData.User.LastName,
			Username:     parsedData.User.Username,
			LanguageCode: parsedData.User.LanguageCode,
			IsPremium:    parsedData.User.IsPremium,
		}
		
		return telegramUser, nil
	}

	// Validate init data with bot token (production mode)
	// Consider init data valid for 24 hours from creation
	if err := initdata.Validate(initDataRaw, s.botToken, 24*time.Hour); err != nil {
		return nil, fmt.Errorf("init data validation failed: %v", err)
	}

	// Parse init data
	parsedData, err := initdata.Parse(initDataRaw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse init data: %v", err)
	}

	// Convert to our TelegramUser struct
	telegramUser := &TelegramUser{
		ID:           int(parsedData.User.ID),
		FirstName:    parsedData.User.FirstName,
		LastName:     parsedData.User.LastName,
		Username:     parsedData.User.Username,
		LanguageCode: parsedData.User.LanguageCode,
		IsPremium:    parsedData.User.IsPremium,
	}

	return telegramUser, nil
}

func (s *Server) createSession(userID string, telegramUser *TelegramUser) (string, error) {
	sessionID := fmt.Sprintf("session_%d_%s", time.Now().UnixNano(), userID)
	
	session := Session{
		UserID: userID,
		TelegramUser: telegramUser,
		CreatedAt: time.Now().Unix(),
		ExpiresAt: time.Now().Unix() + 7776000, // 3 months (90 days)
	}

	sessionData, err := json.Marshal(session)
	if err != nil {
		return "", err
	}

	// Store session in Redis with 3 month expiration
	err = s.rdb.Set(ctx, "session:"+sessionID, sessionData, 90*24*time.Hour).Err()
	if err != nil {
		return "", err
	}

	return sessionID, nil
}

func (s *Server) validateSession(sessionID string) (*Session, error) {
	if sessionID == "" {
		return nil, fmt.Errorf("missing session ID")
	}

	sessionData, err := s.rdb.Get(ctx, "session:"+sessionID).Result()
	if err != nil {
		return nil, fmt.Errorf("invalid session")
	}

	var session Session
	if err := json.Unmarshal([]byte(sessionData), &session); err != nil {
		return nil, fmt.Errorf("invalid session data")
	}

	// Check if session is expired
	if time.Now().Unix() > session.ExpiresAt {
		s.rdb.Del(ctx, "session:"+sessionID)
		return nil, fmt.Errorf("session expired")
	}

	return &session, nil
}

func (s *Server) authenticateRequest(r *http.Request) (*Session, error) {
	// Check for session ID in Authorization header
	authHeader := r.Header.Get("Authorization")
	fmt.Printf("DEBUG: Auth header: %s\n", authHeader)
	
	if strings.HasPrefix(authHeader, "Bearer ") {
		sessionID := strings.TrimPrefix(authHeader, "Bearer ")
		return s.validateSession(sessionID)
	}

	// Check for Telegram init data in Authorization header
	if strings.HasPrefix(authHeader, "tma ") {
		initDataRaw := strings.TrimPrefix(authHeader, "tma ")
		fmt.Printf("DEBUG: Processing init data: %s\n", initDataRaw[:100]+"...")
		
		telegramUser, err := s.validateTelegramInitData(initDataRaw)
		if err != nil {
			fmt.Printf("DEBUG: Init data validation failed: %v\n", err)
			return nil, err
		}

		userID := fmt.Sprintf("%d", telegramUser.ID)
		fmt.Printf("DEBUG: Creating session for user: %s\n", userID)
		
		sessionID, err := s.createSession(userID, telegramUser)
		if err != nil {
			fmt.Printf("DEBUG: Session creation failed: %v\n", err)
			return nil, err
		}

		session, err := s.validateSession(sessionID)
		if err != nil {
			fmt.Printf("DEBUG: Session validation failed: %v\n", err)
			return nil, err
		}

		fmt.Printf("DEBUG: Authentication successful for user: %s\n", userID)
		return session, nil
	}

	// Check for local development mode
	userID := r.URL.Query().Get("user_id")
	if userID == "1234567" {
		// Create a session for local development
		sessionID, err := s.createSession(userID, nil)
		if err != nil {
			return nil, err
		}
		return s.validateSession(sessionID)
	}

	return nil, fmt.Errorf("authentication required")
}

// Helper function to calculate producer cost with scaling (reduced for lower economy)
func calculateProducerCost(baseCost int, owned int) int {
	return int(float64(baseCost) * math.Pow(1.12, float64(owned))) // Reduced from 1.15 to 1.12
}

// Helper function to calculate next power level
func calculateNextPower(currentPower int) int {
	if currentPower < 1 {
		return 1
	}
	
	// Linear power scaling:
	// - Below 1000: +1 per upgrade (1→2→3→4→5→6→7→8→9→10...)
	// - 1000+: Use 1.05x scaling for smooth progression
	if currentPower < 1000 {
		return currentPower + 1
	} else {
		// For high power levels (1000+), use 1.05x scaling
		return int(float64(currentPower) * 1.05)
	}
}

// Helper function to calculate next power price
func calculateNextPowerPrice(currentPrice int) int {
	// Simple incremental price scaling:
	// - Below 1000 power: +10, +20, +30, +40, +50, +60, +70, +80, +90, +100...
	// - 1000+ power: Use 1.4x scaling
	
	// Pre-calculated price table for first 50 upgrades
	priceTable := []int{
		10, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650, 770, 900, 1040, 1190, 1350, 1520, 1700, 1890, 2090,
		2300, 2520, 2750, 2990, 3240, 3500, 3770, 4050, 4340, 4640, 4950, 5270, 5600, 5940, 6290, 6650, 7020, 7400, 7790, 8190,
		8600, 9020, 9450, 9890, 10340, 10800, 11270, 11750, 12240, 12740,
	}
	
	// Find current price in table
	for i, price := range priceTable {
		if currentPrice == price {
			// Return next price in table
			if i+1 < len(priceTable) {
				return priceTable[i+1]
			}
			// If we're at the end of table, use exponential scaling
			return int(float64(currentPrice) * 1.4)
		}
	}
	
	// If price not found in table, assume it's beyond our table and use exponential scaling
	return int(float64(currentPrice) * 1.4)
}

// Helper function to calculate build time based on price (0-172800 seconds)
func calculateBuildTime(price int) int {
	// Scale build time based on price: 0-172800 seconds (48 hours)
	// Higher price = much longer build time
	// Items under 1000000 have instant build time
	var buildTime int
	
	if price < 1000000 {
		// Items under 1000000: 0 seconds (instant)
		buildTime = 0
	} else {
		// Items 1000000+: 1 second to 48 hours based on price
		// Scale from 1s to 172800s (48h) for items 1M to 1T+
		minTime := 1
		maxTime := 172800 // 48 hours
		minPrice := 1000000
		maxPrice := 1000000000000 // 1 trillion
		
		// Clamp price to maxPrice to prevent overflow
		if price > maxPrice {
			price = maxPrice
		}
		
		// Linear scaling from minTime to maxTime
		buildTime = minTime + int(float64(price-minPrice)/float64(maxPrice-minPrice)*float64(maxTime-minTime))
		
		// Ensure we don't exceed max time
		if buildTime > maxTime {
			buildTime = maxTime
		}
	}
	
	return buildTime
}

// Helper function to calculate user's total production rate per second
func (s *Server) getUserProductionRate(userID string) (int, error) {
	producers, err := s.getUserProducers(userID)
	if err != nil {
		return 0, err
	}
	
	totalProduction := 0
	for _, producer := range producers {
		totalProduction += producer.Rate * producer.Owned
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
		
		// Calculate build time for this producer
		if producers[i].Owned == 0 {
			// For unpurchased producers, initial delay = rate * 1.40 + rate
			producers[i].BuildTime = int(float64(producers[i].Rate) * 1.40) + producers[i].Rate
		} else {
			// For subsequent purchases, use variable delay based on cost
			producers[i].BuildTime = calculateBuildTime(producers[i].Cost)
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
		total += p.Rate * p.Owned
	}
	return total, nil
}

// Helper function to mask Telegram ID
func maskTelegramID(userID string) string {
	if len(userID) < 4 {
		return "****"
	}
	
	// Keep first 2 and last 2 characters, mask the middle
	first := userID[:2]
	last := userID[len(userID)-2:]
	middle := strings.Repeat("*", len(userID)-4)
	
	return first + middle + last
}

func (s *Server) handleGetState(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
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
		score = 1000000000000000
	} else {
		// Existing user - get their actual score
		score, _ = s.rdb.Get(ctx, user).Int()
	}
	
	// Return session ID in header if this was a new session
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "tma ") || (user == "1234567" && authHeader == "") {
		// This was a new session, return the session ID
		sessionID, err := s.createSession(user, session.TelegramUser)
		if err == nil {
			w.Header().Set("X-Session-ID", sessionID)
		}
	}
	
	json.NewEncoder(w).Encode(map[string]int{"score": score})
}

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

func (s *Server) handleGetUpgrades(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	user := session.UserID
	score, _ := s.rdb.Get(ctx, user).Int()
	power, err1 := s.rdb.Get(ctx, "power:"+user).Int()
	if err1 != nil { power = 1 }
	price, err2 := s.rdb.Get(ctx, "power_price:"+user).Int()
	if err2 != nil { price = 10 }
	
	// Calculate build time based on price (2-100 seconds)
	buildTime := calculateBuildTime(price)
	
	// Check if user is currently building
	buildEndTime, err3 := s.rdb.Get(ctx, "power_build_end:"+user).Int64()
	if err3 != nil { buildEndTime = 0 }
	
	// Check if build is complete
	now := time.Now().Unix()
	isBuilding := buildEndTime > now
	buildTimeLeft := int64(0)
	if isBuilding {
		buildTimeLeft = buildEndTime - now
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"score": score, 
		"power": power, 
		"price": price,
		"build_time": buildTime,
		"is_building": isBuilding,
		"build_time_left": buildTimeLeft,
	})
}

func (s *Server) handleUpgradePower(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	user := session.UserID
	score, _ := s.rdb.Get(ctx, user).Int()
	power, err1 := s.rdb.Get(ctx, "power:"+user).Int()
	if err1 != nil { power = 1 }
	price, err2 := s.rdb.Get(ctx, "power_price:"+user).Int()
	if err2 != nil { price = 10 }
	
	// Check if user is currently building
	buildEndTime, err3 := s.rdb.Get(ctx, "power_build_end:"+user).Int64()
	if err3 != nil { buildEndTime = 0 }
	
	now := time.Now().Unix()
	isBuilding := buildEndTime > now
	
	// Validation: Check if user has enough score
	if score < price {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false, 
			"message": "insufficient score",
			"power": power, 
			"price": price, 
			"score": score,
		})
		return
	}
	
	// Validation: Check if user is already building
	if isBuilding {
		buildTimeLeft := buildEndTime - now
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false, 
			"message": "upgrade in progress",
			"power": power, 
			"price": price, 
			"score": score,
			"build_time_left": buildTimeLeft,
		})
		return
	}
	
	// Calculate build time for this upgrade
	// Click power upgrades are instant
	buildTime := 0
	
	// Deduct cost
	newScore := score - price
	s.rdb.Set(ctx, user, newScore, 0)
	
	// Update leaderboard
	s.rdb.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: user})
	
	if buildTime == 0 {
		// Instant upgrade - apply immediately
		newPower := calculateNextPower(power)
		newPrice := calculateNextPowerPrice(price)
		s.rdb.Set(ctx, "power:"+user, newPower, 0)
		s.rdb.Set(ctx, "power_price:"+user, newPrice, 0)
		
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true, 
			"power": newPower, 
			"price": newPrice, 
			"score": newScore,
			"build_time": buildTime,
			"build_time_left": 0,
			"is_building": false,
		})
	} else {
		// Delayed upgrade - start building
		buildEndTime = now + int64(buildTime)
		s.rdb.Set(ctx, "power_build_end:"+user, buildEndTime, 0)
		
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true, 
			"power": power, 
			"price": price, 
			"score": newScore,
			"build_time": buildTime,
			"build_time_left": buildTime,
			"is_building": true,
		})
	}
}

func (s *Server) handleClick(w http.ResponseWriter, r *http.Request) {
	session, err := s.authenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	
	userID := session.UserID
	power, errP := s.rdb.Get(ctx, "power:"+userID).Int()
	if errP != nil { power = 1 }
	
	// Check if this is a new user (no score exists)
	exists, err := s.rdb.Exists(ctx, userID).Result()
	if err != nil {
		http.Error(w, "redis error", 500)
		return
	}
	
	var score int64
	if exists == 0 {
		// New user - give them 10000 initial score + power
		score, err = s.rdb.IncrBy(ctx, userID, int64(1000000000000000+power)).Result()
	} else {
		// Existing user - just add power
		score, err = s.rdb.IncrBy(ctx, userID, int64(power)).Result()
	}
	
	if err != nil {
		http.Error(w, "redis error", 500)
		return
	}
	
	// Track total clicks separately
	clicks, err := s.rdb.Incr(ctx, "clicks:"+userID).Result()
	if err != nil {
		http.Error(w, "redis error", 500)
		return
	}
	
	// Update both leaderboards
	s.rdb.ZAdd(ctx, "leaderboard", redis.Z{Score: float64(score), Member: userID})
	s.rdb.ZAdd(ctx, "clicks_leaderboard", redis.Z{Score: float64(clicks), Member: userID})
	s.rdb.Expire(ctx, userID, 365*24*time.Hour)
	s.rdb.Expire(ctx, "clicks:"+userID, 365*24*time.Hour)
	json.NewEncoder(w).Encode(map[string]int{"score": int(score), "power": power, "clicks": int(clicks)})
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
	
	// Get current score
	score, _ := s.rdb.Get(ctx, userID).Int()
	
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
	
	// Calculate build time for this producer
	var buildTime int
	if producer.Owned == 0 {
		// For unpurchased producers, initial delay = rate * 1.40 + rate
		buildTime = int(float64(producer.Rate) * 1.40) + producer.Rate
	} else {
		// For subsequent purchases, use variable delay based on cost
		buildTime = calculateBuildTime(producer.Cost)
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
				
				// Get user's production
				production, err := s.getTotalProduction(userID)
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
		newPower := calculateNextPower(power)
		newPrice := calculateNextPowerPrice(price)
		
		s.rdb.Set(ctx, "power:"+userID, newPower, 0)
		s.rdb.Set(ctx, "power_price:"+userID, newPrice, 0)
		s.rdb.Del(ctx, "power_build_end:"+userID) // Remove build timer
	}
}

// Check and complete producer builds that have finished building
func (s *Server) checkAndCompleteProducerBuilds(userID string) {
	now := time.Now().Unix()
	
	// Check all producers for completed builds
	for _, producer := range defaultProducers {
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
	
	// Start background production
	s.startBackgroundProduction()

	http.HandleFunc("/api/state", s.handleGetState)
	http.HandleFunc("/api/click", s.handleClick)
	http.HandleFunc("/api/leaderboard", s.handleLeaderboard)
	http.HandleFunc("/api/per_second_leaderboard", s.handlePerSecondLeaderboard)
	http.HandleFunc("/api/clicks_leaderboard", s.handleClicksLeaderboard)
	http.HandleFunc("/api/user_upgrades", s.handleGetUpgrades)
	http.HandleFunc("/api/upgrade_power", s.handleUpgradePower)
	http.HandleFunc("/api/producers", s.handleGetProducers)
	http.HandleFunc("/api/buy_producer", s.handleBuyProducer)
	http.HandleFunc("/api/production", s.handleGetProduction)
	http.HandleFunc("/api/donations/goals", s.handleListDonationGoals)
	http.HandleFunc("/api/donations/goal", s.handleGetDonationGoal)
	http.HandleFunc("/api/donations/donate", s.handleDonate)

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

