# Agntly E2E QA Report

**Date:** 2026-03-20 05:30 UTC
**Frontend:** https://sandbox.agntly.io
**API:** https://sandbox.api.agntly.io
**Tester:** Automated E2E

---

## Test Results: 22/24 Passed (91.7%)

### 1. API Gateway ✅
| Test | Result |
|------|--------|
| Health check | ✅ OK |
| Unknown route → 404 | ✅ OK |

### 2. Agent Registry (Public) ✅
| Test | Result |
|------|--------|
| List all agents (6 expected) | ✅ 6 agents returned |
| Get agent by ID (ws-alpha-v3) | ✅ WebSearch Alpha |
| Filter by category=search | ✅ Works |
| Agent not found → 404 | ✅ OK |

### 3. Auth - Magic Link ✅
| Test | Result |
|------|--------|
| Send magic link (valid email) | ✅ Sent |
| Missing email → 400 | ✅ Rejected |
| Invalid token → 401 | ✅ Rejected |

### 4. Auth Protection ✅
| Test | Result |
|------|--------|
| GET /v1/wallets without auth | ✅ 401 |
| GET /v1/tasks without auth | ✅ 401 |
| GET /v1/webhooks without auth | ✅ 401 |
| GET /v1/escrow without auth | ✅ 401 |

### 5. CORS ⚠️
| Test | Result |
|------|--------|
| Allows frontend origin | ✅ sandbox.agntly.io allowed |
| Blocks unknown origins | ❌ evil.com NOT blocked |

**Issue:** CORS reflects all origins despite `ALLOWED_ORIGINS` being set. The `@fastify/cors` plugin may be using the wrong config format. Needs investigation.

### 6. Frontend ✅
| Test | Result |
|------|--------|
| Landing page (/) | ✅ 200 |
| Login page (/auth/login) | ✅ 200 |
| Marketplace (protected) | ✅ 307 redirect to login |
| Dashboard (protected) | ✅ 307 redirect to login |
| Onboarding (protected) | ✅ 307 redirect to login |

### 7. Delight Features ⚠️
| Test | Result |
|------|--------|
| Agent health badge SVG | ✅ 200 with image/svg+xml |
| Badge for unknown agent | ❌ Returns SVG instead of error (cosmetic) |

### 8. SSL/TLS ✅
| Test | Result |
|------|--------|
| API HTTPS | ✅ Works |
| Frontend HTTPS | ✅ Works |

---

## Identified Gaps

### 🔴 BLOCKERS (must fix before developer validation)

**1. Payment service down — Stripe keys are placeholders**
- Status: `errored` on VM (↺2265 restarts)
- Impact: Users cannot fund wallets via Stripe checkout
- Fix: Get real Stripe test mode keys from https://dashboard.stripe.com/test/apikeys
- Set `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_WEBHOOK_SECRET=whsec_...` on VM

**2. Smart contracts NOT deployed to Base Sepolia**
- Impact: No on-chain escrow, no USDC transfers, no settlement proofs, no BaseScan receipt links
- Fix: Fund deployer wallet `0xad1e0B974d5a3a8c0B8C7af4aD69CAc35F076614` with 0.01 Base Sepolia ETH, run `npx hardhat run deploy/deploy.ts --network baseSepolia`
- Get free ETH: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

**3. Settlement worker in dev mode**
- Impact: `escrow.released` and `wallet.withdrawn` events are published but on-chain transactions are skipped
- Fix: After contract deployment, set `ESCROW_CONTRACT_ADDRESS`, `USDC_CONTRACT_ADDRESS`, and `RELAYER_PRIVATE_KEY` on VM

### 🟡 IMPORTANT (should fix before validation)

**4. Fake wallet addresses**
- Wallets use generated hex strings, not real Ethereum addresses
- Impact: Withdrawals to these addresses would fail on-chain
- Fix: Integrate ERC-4337 wallet creation (Coinbase AgentKit or Safe SDK) — significant scope

**5. CI deploy sets NODE_ENV=production → crashes services**
- The production credential guard in `shared/src/db/connection.ts` kills services using default `agntly:agntly` PG credentials
- Fix: Set `NODE_ENV=development` in the deploy workflow, or change the guard to check for truly default credentials only

**6. Services with high restart counts**
- escrow-engine (↺618), task-service (↺621), webhook-service (↺620)
- These are cumulative from before the NODE_ENV fix — services are stable now
- Fix: `pm2 reset all` to clear the counters

**7. Frontend BFF routes use localhost for backend services**
- The marketplace page's API routes (`/api/agents`) point to `http://localhost:3005` which is correct on the VM
- But the `REGISTRY_SERVICE_URL` env var may not be loaded by the frontend at build time
- Verify: the marketplace page should show real agent data

**8. CORS allows all origins**
- Despite `ALLOWED_ORIGINS` being set, the gateway reflects any origin
- Fix: Debug the `@fastify/cors` configuration — may need to pass an array instead of string

### 🟢 NICE TO HAVE (can fix later)

| # | Gap | Impact |
|---|-----|--------|
| 9 | No Playwright E2E tests | Visual testing relies on manual checks |
| 10 | No monitoring/alerting | Services crash silently |
| 11 | No log aggregation | PM2 logs only on VM |
| 12 | Agent dispatch not implemented | task-service creates tasks but doesn't HTTP-call agents |
| 13 | SSE feed not connected to frontend | ActivityFeed uses simulated data |
| 14 | Basic magic link email template | Works but not polished |
| 15 | SDK baseUrl includes port 3000 | Should default to port 443 via gateway |

---

## Service Health on VM

| Service | Status | Restarts | Notes |
|---------|--------|----------|-------|
| api-gateway | ✅ online | 4 | Stable |
| auth-service | ✅ online | 137 | Stable after NODE_ENV fix |
| wallet-service | ✅ online | 457 | Stable after NODE_ENV fix |
| registry-service | ✅ online | 4 | Stable |
| settlement-worker | ✅ online | 4 | Stable (dev mode) |
| frontend | ✅ online | 3 | Stable |
| escrow-engine | ⚠️ online | 618 | High historical restarts |
| task-service | ⚠️ online | 621 | High historical restarts |
| webhook-service | ⚠️ online | 620 | High historical restarts |
| payment-service | ❌ errored | 2265 | Stripe placeholder keys |

---

## Next Steps (Priority Order)

1. **Get Stripe test keys** → fix payment-service
2. **Fund deployer wallet** → deploy contracts to Base Sepolia
3. **Fix CORS** → security issue
4. **Fix CI NODE_ENV** → prevent deploy crashes
5. **Reset PM2 counters** → clean service health display
6. **Connect frontend to live API** → real agent data in marketplace
