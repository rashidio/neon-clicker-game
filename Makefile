# Makefile for Docker Compose project

# Docker Compose command
DC=docker-compose -f docker-compose.yml

.PHONY: build up down restart logs clean

# Build all images
build:
	$(DC) build --no-cache

# Start all services
up:
	BUILD_TIME=$$(date '+%Y-%m-%d %H:%M:%S') docker-compose build frontend
	$(DC) up -d

# Stop all services
down:
	$(DC) down

# Restart services
restart: down up

# Follow logs
logs:
	$(DC) logs -f

# Remove all stopped containers and unused volumes
clean:
	$(DC) down -v --rmi all --remove-orphans

# VPS host
VPS=eu
.PHONY: push deploy push-deploy cleanup setup-env

push:
	./scripts/build_and_push.sh

deploy:
	./scripts/deploy.sh

setup-env:
	./scripts/setup-env.sh

push-deploy: push deploy
	@echo "🎉 Deployment complete!"

everything: 
	make push-deploy
	make up

fe:
	docker-compose build frontend
	make up