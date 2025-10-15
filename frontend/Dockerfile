# === Stage 1: Build React app ===
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build arguments
ARG VITE_FORCE_USER_ID
ENV VITE_FORCE_USER_ID=$VITE_FORCE_USER_ID

# Copy package files and install deps
COPY package*.json ./

RUN npm install --frozen-lockfile

# Copy rest of the source and build
COPY . .

RUN npm run build

# === Stage 2: Serve with Nginx ===
FROM nginx:alpine

# Copy built React files from previous stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Optional: custom nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
