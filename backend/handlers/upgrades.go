package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	core "neon-clicker/core"
	"github.com/redis/go-redis/v9"
)

type Upgrades struct {
	RDB  *redis.Client
	Auth *Auth
}

func NewUpgrades(rdb *redis.Client, auth *Auth) *Upgrades {
	return &Upgrades{RDB: rdb, Auth: auth}
}

func (u *Upgrades) HandleGetUpgrades(w http.ResponseWriter, r *http.Request) {
	session, err := u.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	ctx := context.Background()
	user := session.UserID
	score, _ := u.rdb().Get(ctx, user).Int()
	power, err1 := u.rdb().Get(ctx, "power:"+user).Int()
	if err1 != nil { power = 1 }
	price := core.CalculateNextPowerPrice(power)
	buildTime := 0
	buildEndTime, err3 := u.rdb().Get(ctx, "power_build_end:"+user).Int64()
	if err3 != nil { buildEndTime = 0 }
	now := time.Now().Unix()
	isBuilding := buildEndTime > now
	buildTimeLeft := int64(0)
	if isBuilding { buildTimeLeft = buildEndTime - now }
	json.NewEncoder(w).Encode(map[string]interface{}{
		"score": score,
		"power": power,
		"price": price,
		"build_time": buildTime,
		"is_building": isBuilding,
		"build_time_left": buildTimeLeft,
	})
}

func (u *Upgrades) HandleUpgradePower(w http.ResponseWriter, r *http.Request) {
	session, err := u.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	ctx := context.Background()
	user := session.UserID
	score, _ := u.rdb().Get(ctx, user).Int()
	power, err1 := u.rdb().Get(ctx, "power:"+user).Int()
	if err1 != nil { power = 1 }
	price := core.CalculateNextPowerPrice(power)
	buildEndTime, err3 := u.rdb().Get(ctx, "power_build_end:"+user).Int64()
	if err3 != nil { buildEndTime = 0 }
	now := time.Now().Unix()
	isBuilding := buildEndTime > now
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
	buildTime := 0
	newScore := score - price
	u.rdb().Set(ctx, user, newScore, 0)
	u.rdb().ZAdd(ctx, "leaderboard", redis.Z{Score: float64(newScore), Member: user})
	if buildTime == 0 {
		newPower := core.CalculateNextPower(power)
		newPrice := core.CalculateNextPowerPrice(newPower)
		u.rdb().Set(ctx, "power:"+user, newPower, 0)
		u.rdb().Set(ctx, "power_price:"+user, newPrice, 0)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"power": newPower,
			"price": newPrice,
			"score": newScore,
			"build_time": buildTime,
			"build_time_left": 0,
			"is_building": false,
		})
		return
	}
	buildEndTime = now + int64(buildTime)
	u.rdb().Set(ctx, "power_build_end:"+user, buildEndTime, 0)
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

func (u *Upgrades) HandleClick(w http.ResponseWriter, r *http.Request) {
	session, err := u.Auth.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}
	ctx := context.Background()
	userID := session.UserID
	power, errP := u.rdb().Get(ctx, "power:"+userID).Int()
	if errP != nil { power = 1 }
	exists, err := u.rdb().Exists(ctx, userID).Result()
	if err != nil { http.Error(w, "redis error", 500); return }
	var score int64
	if exists == 0 {
		score, err = u.rdb().IncrBy(ctx, userID, int64(core.InitialScore+power)).Result()
	} else {
		score, err = u.rdb().IncrBy(ctx, userID, int64(power)).Result()
	}
	if err != nil { http.Error(w, "redis error", 500); return }
	clicks, err := u.rdb().Incr(ctx, "clicks:"+userID).Result()
	if err != nil { http.Error(w, "redis error", 500); return }
	u.rdb().ZAdd(ctx, "leaderboard", redis.Z{Score: float64(score), Member: userID})
	u.rdb().ZAdd(ctx, "clicks_leaderboard", redis.Z{Score: float64(clicks), Member: userID})
	u.rdb().Expire(ctx, userID, core.UserDataTTL)
	u.rdb().Expire(ctx, "clicks:"+userID, core.UserDataTTL)
	json.NewEncoder(w).Encode(map[string]int{"score": int(score), "power": power, "clicks": int(clicks)})
}

func (u *Upgrades) rdb() *redis.Client { return u.RDB }
