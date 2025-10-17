package main

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
