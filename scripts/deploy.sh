#!/usr/bin/env bash
# Deploy agntly to Azure VM (agntly-vm / AGNTLY-SANDBOX)
# Uses az vm run-command — no SSH key required, just `az login`
#
# Usage:
#   ./scripts/deploy.sh            # deploy current master
#   ./scripts/deploy.sh --check    # check vm status only

set -euo pipefail

RESOURCE_GROUP="AGNTLY-SANDBOX"
VM_NAME="agntly-vm"
VM_USER="agntly"

if [[ "${1:-}" == "--check" ]]; then
  echo "==> Checking VM status..."
  az vm run-command invoke \
    -g "$RESOURCE_GROUP" -n "$VM_NAME" \
    --command-id RunShellScript \
    --scripts "su - $VM_USER -s /bin/bash -c 'cd ~/agntly && git log --oneline -3 && echo --- && pm2 status'" \
    --query "value[0].message" -o tsv
  exit 0
fi

echo "==> Deploying agntly to $VM_NAME..."
echo "    Resource group: $RESOURCE_GROUP"
echo "    This runs the same steps as the GitHub Actions deploy workflow."
echo ""

# Build the inner deploy script, base64-encode it to avoid quoting issues
# Mirrors .github/workflows/deploy.yml deploy steps exactly
INNER_SCRIPT=$(base64 -i - <<'INNER'
set -e

export HOME=/home/agntly
export PM2_HOME=/home/agntly/.pm2
export PATH="/home/agntly/.nvm/versions/node/$(ls /home/agntly/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

cd /home/agntly/agntly

echo "[1/8] Pulling latest code..."
git config --global --add safe.directory /home/agntly/agntly 2>/dev/null || true
git stash pop 2>/dev/null || true
git checkout -- . 2>/dev/null || true
git pull origin master

echo "[2/8] Ensuring NODE_ENV=development for sandbox..."
sed -i 's/NODE_ENV=production/NODE_ENV=development/' .env 2>/dev/null || true

echo "[3/8] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[4/8] Building shared package..."
pnpm --filter @agntly/shared build

echo "[5/8] Building wallet-service..."
pnpm --filter @agntly/wallet-service build 2>/dev/null || true

echo "[6/8] Building frontend..."
source .env
export AUTH_SERVICE_URL="http://localhost:3001"
export REGISTRY_SERVICE_URL="http://localhost:3005"
export NEXT_PUBLIC_APP_URL="https://agntly.io"
cd frontend && rm -rf .next && ./node_modules/.bin/next build && cd ..

echo "[7/8] Running migrations..."
source .env
psql "$DATABASE_URL" -f scripts/migrate.sql 2>/dev/null || true

echo "[8/8] Restarting services..."
pm2 delete license-service 2>/dev/null || true
pm2 restart all --update-env

sleep 3
pm2 status

echo ""
echo "Deployed successfully at $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
INNER
)

# The outer script (runs as root on VM):
# Decodes the inner script, sets ownership, runs it as the agntly user
OUTER_SCRIPT="
echo '$INNER_SCRIPT' | base64 -d > /tmp/agntly-deploy.sh
chown $VM_USER:$VM_USER /tmp/agntly-deploy.sh
chmod +x /tmp/agntly-deploy.sh
su - $VM_USER -s /bin/bash /tmp/agntly-deploy.sh
EXIT_CODE=\$?
rm -f /tmp/agntly-deploy.sh
exit \$EXIT_CODE
"

echo "==> Running deploy on VM (this takes ~3-5 min for the Next.js build)..."
echo ""

OUTPUT=$(az vm run-command invoke \
  -g "$RESOURCE_GROUP" -n "$VM_NAME" \
  --command-id RunShellScript \
  --scripts "$OUTER_SCRIPT" \
  --query "value[0].message" -o tsv 2>&1)

echo "$OUTPUT"

if echo "$OUTPUT" | grep -q "Deployed successfully"; then
  echo ""
  echo "==> Deploy complete. https://agntly.io"
else
  echo ""
  echo "==> WARNING: Could not confirm successful deploy. Check output above."
  exit 1
fi
