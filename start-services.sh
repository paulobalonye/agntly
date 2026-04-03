#!/usr/bin/env bash
# Start a TypeScript service using tsx (used by PM2 via ecosystem.config.js)
# Usage: ./start-services.sh services/auth-service/src/server.ts
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
exec ./node_modules/.bin/tsx "$1"
