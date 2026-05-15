#!/usr/bin/env bash
# Provision a fresh Ubuntu 22.04 VM for Agntly
# Usage: ssh agntly@<IP> 'bash -s' < scripts/provision-vm.sh
#
# This installs: Node 22, pnpm, PostgreSQL 16, Redis, nginx, certbot, PM2
# Then clones the repo and sets up the app.

set -euo pipefail

echo "=== [1/8] System packages ==="
sudo apt-get update -qq
sudo apt-get install -y -qq git curl build-essential nginx certbot python3-certbot-nginx ufw

echo "=== [2/8] PostgreSQL 16 ==="
if ! command -v psql &>/dev/null; then
  sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-16
fi
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo "=== [3/8] Redis ==="
if ! command -v redis-cli &>/dev/null; then
  sudo apt-get install -y -qq redis-server
fi
sudo systemctl enable redis-server
sudo systemctl start redis-server

echo "=== [4/8] Node.js 22 via nvm ==="
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
nvm alias default 22

echo "=== [5/8] pnpm + PM2 ==="
npm install -g pnpm@9 pm2
pm2 startup systemd -u agntly --hp /home/agntly 2>/dev/null || true

echo "=== [6/8] Create database ==="
sudo -u postgres psql -c "CREATE USER agntly WITH PASSWORD 'agntly' CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE agntly OWNER agntly;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE agntly_test OWNER agntly;" 2>/dev/null || true

echo "=== [7/8] Clone repo ==="
if [ ! -d "$HOME/agntly" ]; then
  git clone https://github.com/paulobalonye/agntly.git "$HOME/agntly"
fi
cd "$HOME/agntly"
git pull origin master

echo "=== [8/8] Firewall ==="
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo ""
echo "=== Provisioning complete ==="
echo "Next steps:"
echo "  1. Copy .env file to ~/agntly/.env"
echo "  2. Run: cd ~/agntly && pnpm install && pnpm --filter @agntly/shared build"
echo "  3. Run: psql \$DATABASE_URL -f scripts/migrate.sql"
echo "  4. Set up nginx + SSL: sudo certbot --nginx -d <domain>"
echo "  5. Build frontend: cd frontend && ./node_modules/.bin/next build"
echo "  6. Start: pm2 start ecosystem.config.js && pm2 save"
