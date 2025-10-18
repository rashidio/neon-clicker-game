# backend/Dockerfile

# --- Build stage ---
FROM golang:1.25-alpine AS builder

# Install git (needed for modules)
RUN apk add --no-cache git

WORKDIR /app

# Copy go.mod and go.sum first to leverage caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the binary (build the whole package so all files in package main are included)
RUN go build -o neon-clicker .

# --- Final stage ---
FROM alpine:latest

# For logging timestamps
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy the built binary
COPY --from=builder /app/neon-clicker .

# Expose port
# EXPOSE 8080

# Run the binary
CMD ["./neon-clicker"]

