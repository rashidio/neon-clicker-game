package app

import (
	"os"

	"github.com/redis/go-redis/v9"
)

type Config struct {
	RedisAddr string
	BotToken  string
}

func LoadConfig() Config {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	return Config{
		RedisAddr: addr,
		BotToken:  os.Getenv("TELEGRAM_BOT_TOKEN"),
	}
}

func NewRedis(addr string) *redis.Client {
	return redis.NewClient(&redis.Options{Addr: addr})
}
