package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	initdata "github.com/telegram-mini-apps/init-data-golang"
)

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
