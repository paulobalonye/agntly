## Deploy Configuration

- Platform: Azure VM (az vm run-command)
- Resource group: agntly-rg (eastus)
- VM: agntly-vm
- Public IP: 20.51.204.61
- Production URL: https://agntly.io
- Sandbox URL: https://sandbox.agntly.io
- Deploy workflow: .github/workflows/deploy.yml (sandbox, auto on push to master)
- Deploy workflow: .github/workflows/deploy-production.yml (production, auto on push to production branch)
- Project type: monorepo — Next.js frontend + Fastify microservices + Postgres + Redis

### Single-VM dual-environment setup
- Both sandbox and production run on the same VM
- Sandbox: ports 4000-4008 (services), 4100 (frontend)
- Production: ports 3000-3008 (services), 3100 (frontend)
- Shared infra: Postgres + Redis via Docker at /opt/agntly/infra/
- Sandbox DB: postgresql://agntly:agntly@localhost:5432/agntly_sandbox
- Production DB: postgresql://agntly:agntly@localhost:5432/agntly_production
- PM2 configs: ecosystem.sandbox.config.cjs / ecosystem.production.config.cjs
- App dirs: /opt/agntly/sandbox/ and /opt/agntly/production/
- Nginx routes by subdomain to the correct port

### GitHub Secrets required
- AGNTLY_VM_HOST = 20.51.204.61
- VM_SSH_KEY = (private SSH key for agntly user)

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: push to master (sandbox) or push to production branch (production)
- Health check sandbox: https://sandbox.agntly.io
- Health check production: https://agntly.io

### Self-hosted Supabase
- Stack dir: /opt/supabase/ (docker compose with override)
- Kong (API gateway): localhost:8000 → https://auth.agntly.io
- Supabase URL: https://auth.agntly.io
- ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDB9.-nbKQf4YnID2PGwhL0uvXSMS9qUKyuErxvl0NS5ULPw
- SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.bYB26SPn7rmKLDqRkGpItuLLZcF02sdl-sf98xor3Qk
- docker-compose.override.yml removes Kong's analytics healthcheck dependency
- Start: cd /opt/supabase && docker compose up -d
- Status: docker ps --filter name=supabase

### SSL Certificates
- agntly.io cert: covers agntly.io, www.agntly.io, api.agntly.io, sandbox.agntly.io, sandbox.api.agntly.io
- auth.agntly.io cert: covers auth.agntly.io
- Expires: ~2026-08-13 (auto-renewal via certbot)

### PM2 Startup Persistence
- Systemd service: pm2-agntly.service (enabled, runs as agntly user)
- Save list: sudo -u agntly pm2 save
- Dump file: /home/agntly/.pm2/dump.pm2

### VM management
- Run commands: az vm run-command invoke --resource-group agntly-rg --name agntly-vm --command-id RunShellScript --scripts "..."
- Re-auth if needed: az login --scope https://management.core.windows.net//.default
- Infra stack: cd /opt/agntly/infra && docker compose ps
