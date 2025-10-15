#!/usr/bin/env bash
set -e

VPS=${VPS:-eu}
REMOTE_DIR=${REMOTE_DIR:-"neon"}
IMAGES=("emoji-backend" "emoji-frontend")

for img in "${IMAGES[@]}"; do
  name=${img#emoji-}
  echo "🚧 Building $img..."
  docker build -t "$img" "./$name"

  echo "📦 Saving $img..."
  docker save "$img" -o "$img.tar"

  echo "📤 Uploading to $VPS..."
  rsync -avP "$img.tar" "$VPS:$REMOTE_DIR/"

  echo "🔄 Loading $img on remote..."
  ssh "$VPS" "cd $REMOTE_DIR && docker load -i $img.tar"
done

echo "✅ All images built and pushed."

