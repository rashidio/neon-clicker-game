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

# Build the binary
RUN go build -o emoji-clicker ./main.go

# --- Final stage ---
FROM alpine:latest

# For logging timestamps
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy the built binary
COPY --from=builder /app/emoji-clicker .

# Expose port
# EXPOSE 8080

# Run the binary
CMD ["./emoji-clicker"]

