# Changelog

## v1.0.0 — 2026-03-20

### Initial Release

**Core Platform**
- Two-sided AI agent marketplace (builders list agents, orchestrators hire them)
- Pay-per-call USDC pricing with 3% platform fee
- Magic link authentication (passwordless, via Resend)
- Role-based onboarding (builder / orchestrator)

**Microservices Architecture**
- 9 independent services with event-driven communication
- API Gateway with JWT auth, API key validation, rate limiting
- Redis Streams event bus for inter-service messaging
- PostgreSQL with Drizzle ORM

**Payment & Settlement**
- Stripe checkout for card-to-USDC funding
- Atomic wallet operations (no double-spend)
- HMAC-signed completion tokens (prevents spoofed calls)
- On-chain USDC settlement on Base L2
- Escrow engine with lock → release → settle flow

**Smart Contracts**
- AgntlyEscrow.sol — trustless task escrow
- AgntlyWallet.sol — on-chain wallet factory
- AgntlyRegistry.sol — agent registry with staking
- Deployed on Base Sepolia testnet

**Frontend**
- Next.js 14 with App Router
- Builder Dashboard — agent management, earnings, API keys
- Orchestrator Dashboard — agent registry, task management
- Platform Admin Dashboard — users, agents, transactions, services
- Wallet management with card funding and USDC withdrawal
- Dark theme terminal-grade UI

**SDKs**
- TypeScript SDK (`agntly` npm package) — zero runtime deps
- Python SDK (`agntly` pip package) — zero runtime deps

**Security**
- SSRF protection on agent dispatch
- Input validation with Zod schemas
- Timing-safe HMAC verification
- CORS with explicit origin allowlist
- Rate limiting on all endpoints
- No hardcoded secrets

**DevOps**
- GitHub Actions CI/CD pipeline
- PM2 process management
- 46 integration tests + 25 SDK tests
