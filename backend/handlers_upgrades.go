package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

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
    
    // Dynamic pricing based on current power
    price := calculateNextPowerPrice(power)
    
    // Click power upgrades are instant
    buildTime := 0
    
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
    // Compute expected price dynamically from current power
    price := calculateNextPowerPrice(power)
    
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
        newPrice := calculateNextPowerPrice(newPower)
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
        score, err = s.rdb.IncrBy(ctx, userID, int64(10000+power)).Result()
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
