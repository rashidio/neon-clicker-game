package core

import "strings"

// MaskTelegramID masks a user ID, keeping first and last 2 chars
func MaskTelegramID(userID string) string {
    if len(userID) < 4 {
        return "****"
    }
    first := userID[:2]
    last := userID[len(userID)-2:]
    middle := strings.Repeat("*", len(userID)-4)
    return first + middle + last
}
