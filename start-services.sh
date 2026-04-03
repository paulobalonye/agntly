#!/usr/bin/env bash
# Start a TypeScript service using tsx (used by PM2 via ecosystem.config.js)
# Usage: ./start-services.sh services/auth-service/src/server.ts
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# tsx lives in each service's node_modules, not the root
SERVICE_DIR=$(dirname "$(dirname "$1")")
if [ -x "$SERVICE_DIR/node_modules/.bin/tsx" ]; then
  exec "$SERVICE_DIR/node_modules/.bin/tsx" "$1"
else
  exec npx tsx "$1"
fi
