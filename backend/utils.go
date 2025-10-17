package main

import "strings"

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
