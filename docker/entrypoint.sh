#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Copy config.example.json to config.json if config.json does not exist
if [ ! -f /app/config.json ]; then
  echo "No config.json found, copying from config.example.json..."
  cp /app/config.example.json /app/config.json
fi

# Execute the CMD (supervisord by default)
exec "$@"
