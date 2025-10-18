package core

import "time"

const (
    // Game economy
    InitialScore = 10000

    // Session and data retention
    SessionTTL   = 90 * 24 * time.Hour
    UserDataTTL  = 365 * 24 * time.Hour

    // Leaderboards
    LeaderboardPageSize       = 20
    PerSecondLeaderboardLimit = 20

    // Power upgrade pricing model
    PaybackClicks = 200
    RoundBase     = 10

    // Build-time model
    BuildTimeInstantThreshold = 100000
    BuildTimeMinPrice         = 1000000
    BuildTimeMaxPrice         = 500_000_000
    BuildTimeMaxSeconds       = 172800 // 48h
)
