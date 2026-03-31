## Deploy Configuration (configured by /setup-deploy)
- Platform: Azure VM (az vm run-command)
- VM: agntly-vm (AGNTLY-SANDBOX / eastus)
- Public IP: 20.124.202.195
- Production URL: https://agntly.io
- Deploy workflow: .github/workflows/deploy.yml (auto on push to master)
- Project type: monorepo — Next.js frontend + Fastify microservices + Postgres + Redis
- Post-deploy health check: https://agntly.io

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: `./scripts/deploy.sh` (local, via az vm run-command) or auto on push to master
- Deploy status: `./scripts/deploy.sh --check`
- Health check: https://agntly.io
