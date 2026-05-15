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

### VM management
- Run commands: az vm run-command invoke --resource-group agntly-rg --name agntly-vm --command-id RunShellScript --scripts "..."
- Re-auth if needed: az login --scope https://management.core.windows.net//.default
- Infra stack: cd /opt/agntly/infra && docker compose ps
