package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	core "neon-clicker/core"
	initdata "github.com/telegram-mini-apps/init-data-golang"
	"github.com/redis/go-redis/v9"
)

type Auth struct {
	RDB      *redis.Client
	BotToken string
}

func NewAuth(rdb *redis.Client, botToken string) *Auth {
	return &Auth{RDB: rdb, BotToken: botToken}
}

// Telegram authentication functions using official library
func (a *Auth) ValidateTelegramInitData(initDataRaw string) (*core.TelegramUser, error) {
	// For development/testing, allow validation without bot token
	if a.BotToken == "" {
		fmt.Println("WARNING: Bot token not configured, skipping HMAC validation")
		parsedData, err := initdata.Parse(initDataRaw)
		if err != nil {
			return nil, fmt.Errorf("failed to parse init data: %v", err)
		}
		telegramUser := &core.TelegramUser{
			ID:           int(parsedData.User.ID),
			FirstName:    parsedData.User.FirstName,
			LastName:     parsedData.User.LastName,
			Username:     parsedData.User.Username,
			LanguageCode: parsedData.User.LanguageCode,
			IsPremium:    parsedData.User.IsPremium,
		}
		return telegramUser, nil
	}

	// Validate init data using bot token
	if err := initdata.Validate(initDataRaw, a.BotToken, 24*time.Hour); err != nil {
		return nil, fmt.Errorf("init data validation failed: %v", err)
	}
	parsedData, err := initdata.Parse(initDataRaw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse init data: %v", err)
	}
	telegramUser := &core.TelegramUser{
		ID:           int(parsedData.User.ID),
		FirstName:    parsedData.User.FirstName,
		LastName:     parsedData.User.LastName,
		Username:     parsedData.User.Username,
		LanguageCode: parsedData.User.LanguageCode,
		IsPremium:    parsedData.User.IsPremium,
	}
	return telegramUser, nil
}

func (a *Auth) CreateSession(userID string, telegramUser *core.TelegramUser) (string, error) {
	sessionID := fmt.Sprintf("session_%d_%s", time.Now().UnixNano(), userID)
	session := core.Session{
		UserID:       userID,
		TelegramUser: telegramUser,
		CreatedAt:    time.Now().Unix(),
		ExpiresAt:    time.Now().Add(core.SessionTTL).Unix(),
	}
	data, err := json.Marshal(session)
	if err != nil { 
		return "", err 
	}
	if err := a.RDB.Set(context.Background(), "session:"+sessionID, data, core.SessionTTL).Err(); err != nil {
		return "", err
	}
	return sessionID, nil
}

func (a *Auth) ValidateSession(sessionID string) (*core.Session, error) {
	if sessionID == "" { 
		return nil, fmt.Errorf("missing session ID") 
	}
	val, err := a.RDB.Get(context.Background(), "session:"+sessionID).Result()
	if err != nil { 
		return nil, fmt.Errorf("invalid session") 
	}
	if err != nil { return nil, fmt.Errorf("invalid session") }
	var session core.Session
	if err := json.Unmarshal([]byte(val), &session); err != nil { return nil, fmt.Errorf("invalid session data") }
	if time.Now().Unix() > session.ExpiresAt {
		a.RDB.Del(context.Background(), "session:"+sessionID)
		return nil, fmt.Errorf("session expired")
	}
	return &session, nil
}

func (a *Auth) AuthenticateRequest(r *http.Request) (*core.Session, error) {
	// Check for session ID in Authorization header
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		sessionID := strings.TrimPrefix(authHeader, "Bearer ")
		return a.ValidateSession(sessionID)
	}
	// Check for Telegram init data in Authorization header
	if strings.HasPrefix(authHeader, "tma ") {
		initData := strings.TrimPrefix(authHeader, "tma ")
		tg, err := a.ValidateTelegramInitData(initData)
		if err != nil { return nil, err }
		userID := fmt.Sprintf("%d", tg.ID)
		sessionID, err := a.CreateSession(userID, tg)
		if err != nil { return nil, err }
		session := &core.Session{UserID: userID, TelegramUser: tg, CreatedAt: time.Now().Unix(), ExpiresAt: time.Now().Unix() + 7776000}
		_ = sessionID // session stored, caller may set header if needed
		return session, nil
	}
	return nil, fmt.Errorf("unauthorized")
}
