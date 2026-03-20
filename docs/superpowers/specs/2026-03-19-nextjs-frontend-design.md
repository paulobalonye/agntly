# Next.js Frontend — Landing + Onboarding + Marketplace

## Overview

Port the existing HTML mockups (`app.html`, `marketplace.html`) into a Next.js 14 App Router application. Three pages: landing (hero + how it works + roles), onboarding wizard (3-step role/framework/wallet flow), and agent marketplace (3-column registry browser with live feed). Same dark theme, fonts, and green accent from the mockups. Data fetched via the TypeScript SDK through Next.js API routes.

## Design System

Ported directly from the HTML mockups:

```
Colors:
  --bg0: #07090d       (page background)
  --bg1: #0d1117       (card/panel background)
  --bg2: #131920       (hover/input background)
  --border: #1e2d3d    (borders)
  --t0: #e8edf2        (primary text)
  --t1: #8fa8c0        (secondary text)
  --t2: #4d6478        (muted text)
  --accent: #00e5a0    (green — primary accent)
  --blue: #4d9ef5
  --amber: #f5a623
  --red: #e05252
  --purple: #9b7cf8

Fonts:
  IBM Plex Mono (monospace — labels, stats, code)
  Figtree (display — headings)
  DM Sans (body text)

Patterns:
  Grid background (subtle lines, 0.1 opacity)
  No border-radius (sharp corners — the "terminal" aesthetic)
  Animated pulse dots for live indicators
```

All implemented via Tailwind CSS with a custom theme in `tailwind.config.ts`.

## Pages

### 1. Landing Page (`/`)

Source: `app.html #page-landing`

Sections:
- **Nav** — Logo (pulsing dot + AGNTLY.IO), links (browse registry, list your agent), CTA button
- **Hero** — Title ("Agents that earn. Agents that pay each other."), subtitle, CTA buttons, animated SVG flow diagram, stats counters (agents, tasks/day, volume)
- **How it Works** — 3-step cards (Build → List → Earn) connected by a horizontal line
- **Roles** — 3-column grid (Agent Developer, Orchestrator Builder, End User) with click-to-onboard
- **Live Ticker** — Scrolling horizontal strip of real-time settlement events
- **CTA** — Final call to action section
- **Footer** — Links + chain pill (Base L2 indicator)

Server component — static content, no API calls needed. Stats can be hardcoded initially and replaced with API calls later.

### 2. Onboarding Wizard (`/onboard`)

Source: `app.html #page-onboard`

Client component with local state managing 3 steps:

- **Step 1: Choose Role** — 3 cards (Agent Developer, Orchestrator, Both) with icons. Click to select.
- **Step 2: Pick Framework** — Grid of framework options (LangChain, CrewAI, AutoGen, Custom, Python, Node.js). Shows a code preview that updates based on selection.
- **Step 3: Wallet Setup** — Input for existing wallet address OR "Create new wallet" button. Info box explaining what happens next.

Progress bar at top (3 segments). Back/Next/Skip buttons. On completion, redirects to `/marketplace`.

No API calls — this is a guided introduction flow. Wallet creation happens via the SDK when the user is ready (future scope).

### 3. Marketplace (`/marketplace`)

Source: `marketplace.html`

3-column layout:
- **Left sidebar (220px)** — Search input, category filters (web search, code executor, data processor, file/doc, API caller, LLM wrapper), status filters (online, busy), price range slider, reputation filters
- **Main content (flex)** — Stats bar (registered agents, tasks settled, volume, latency, chain), sort buttons (volume, price, rating, newest), agent cards grid (auto-fill, min 300px)
- **Right panel (280px)** — Settlement volume sparkline chart, live settlements feed (auto-rotating), top earners leaderboard

**Agent Card** — Icon + name + ID, status pill (online/busy/offline), description, tags, 3-metric row (calls/24h, uptime, latency), price + connect button. Featured badge for promoted agents.

**Agent Modal** — Triggered on card click. Shows full stats grid (6 metrics), code snippet (Python quickstart with actual agent ID), connect + docs + copy buttons.

**Data source:** Server component fetches agents via `GET /api/agents` (Next.js API route → SDK → registry-service). The live feed and leaderboard use client-side state with simulated data (same as the HTML mockup) until WebSocket support is added.

### Navigation

- **Landing nav** — Simple: logo + ghost buttons + CTA. Links to `/marketplace` and `/onboard`.
- **Marketplace nav** — Full: logo + nav links (registry, my_agents, wallet, docs, analytics) + tickers (tasks/24h, volume, avg fee) + connect wallet + list agent buttons.

Two separate nav components — the landing nav is minimal, the marketplace nav is data-rich.

## Data Layer

### Next.js API Routes (BFF)

```
app/api/agents/route.ts        → GET: SDK client.agents.list(query)
app/api/agents/[id]/route.ts   → GET: SDK client.agents.get(id)
```

The API routes instantiate the Agntly SDK with a server-side API key:

```typescript
import { Agntly } from 'agntly';

const agntly = new Agntly({
  apiKey: process.env.AGNTLY_API_KEY ?? '',
  baseUrl: process.env.AGNTLY_API_URL ?? 'http://localhost:3005',
});
```

Server components call these API routes via `fetch('/api/agents')` during SSR. Client components use them for dynamic filtering/search.

### Live Data (Client-Side)

The activity feed, tickers, and leaderboard use client-side simulated data (matching the HTML mockup's JavaScript) until a WebSocket/SSE endpoint is added. The simulation logic is extracted into a `useSimulatedFeed` hook.

## Component Architecture

```
components/
├── landing/
│   ├── LandingNav.tsx          — Minimal nav for landing page
│   ├── HeroSection.tsx         — Title, subtitle, CTAs, flow SVG, stats
│   ├── HowItWorks.tsx          — 3-step cards with connecting line
│   ├── RolesSection.tsx         — 3-column role cards
│   ├── LiveTicker.tsx           — Scrolling settlement strip
│   └── CTASection.tsx           — Final CTA block
├── marketplace/
│   ├── MarketplaceNav.tsx       — Full nav with tickers
│   ├── StatsBar.tsx             — 5-cell stat strip
│   ├── FilterSidebar.tsx        — Categories, status, price range
│   ├── AgentCard.tsx            — Individual agent card
│   ├── AgentGrid.tsx            — Grid container with sort controls
│   ├── AgentModal.tsx           — Detail modal with code snippet
│   ├── ActivityFeed.tsx         — Live settlement feed
│   ├── Leaderboard.tsx          — Top earners table
│   └── SparklineChart.tsx       — SVG sparkline for volume
├── onboarding/
│   ├── OnboardingWizard.tsx     — Step state management
│   ├── RoleStep.tsx             — Step 1: role selection
│   ├── FrameworkStep.tsx        — Step 2: framework picker + code preview
│   └── WalletStep.tsx           — Step 3: wallet setup
└── shared/
    ├── Footer.tsx               — Chain pill + links
    ├── GridBackground.tsx       — CSS grid overlay
    └── StatusPill.tsx           — Online/busy/offline pill
```

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `frontend/package.json` | Next.js 14 + Tailwind + agntly SDK |
| Create | `frontend/tailwind.config.ts` | Custom dark theme from mockups |
| Create | `frontend/app/layout.tsx` | Root layout (fonts, global CSS, grid bg) |
| Create | `frontend/app/page.tsx` | Landing page |
| Create | `frontend/app/onboard/page.tsx` | Onboarding wizard |
| Create | `frontend/app/marketplace/page.tsx` | Agent marketplace |
| Create | `frontend/app/marketplace/layout.tsx` | Marketplace nav + stats + footer |
| Create | `frontend/app/api/agents/route.ts` | BFF: list agents via SDK |
| Create | `frontend/app/api/agents/[id]/route.ts` | BFF: get agent by ID via SDK |
| Create | `frontend/components/landing/*.tsx` | 6 landing page components |
| Create | `frontend/components/marketplace/*.tsx` | 9 marketplace components |
| Create | `frontend/components/onboarding/*.tsx` | 4 onboarding components |
| Create | `frontend/components/shared/*.tsx` | 3 shared components |
| Create | `frontend/app/globals.css` | Tailwind directives + custom CSS |

### 4. Builder Dashboard (`/dashboard`)

Authenticated page for agent builders to manage their agents and earnings.

Sections:
- **Dashboard Nav** — Same marketplace nav but with "dashboard" link active
- **Overview cards** — Total earned (all time), earnings today, active agents count, average rating
- **Earnings chart** — Daily earnings bar chart (last 30 days), built with SVG (no chart library)
- **My Agents table** — List of builder's agents with: name, status pill, price, calls/24h, earnings/24h, uptime. Click row → agent detail page or edit modal
- **Recent Tasks** — Last 20 tasks handled by builder's agents: task ID, agent, amount, status, timestamp
- **Wallet section** — Balance, locked amount, address, withdraw button, recent withdrawals list
- **API Keys** — List keys (prefix + label + last used), create new key, revoke key

Data sources:
- `GET /api/dashboard/overview` → aggregated stats from registry + wallet services
- `GET /api/dashboard/agents` → SDK `client.agents.list()` filtered by owner
- `GET /api/dashboard/earnings` → task history aggregated by day
- `GET /api/dashboard/wallet` → SDK `client.wallets.get()`
- `GET /api/dashboard/withdrawals` → SDK `client.wallets.withdrawals()`

Components:
```
components/dashboard/
├── OverviewCards.tsx        — 4 stat cards
├── EarningsChart.tsx        — SVG bar chart
├── MyAgentsTable.tsx        — Agent list with status/metrics
├── RecentTasks.tsx          — Task history table
├── WalletSection.tsx        — Balance + withdraw + history
└── ApiKeysSection.tsx       — Key management
```

Additional API routes:
```
app/api/dashboard/overview/route.ts
app/api/dashboard/agents/route.ts
app/api/dashboard/earnings/route.ts
app/api/dashboard/wallet/route.ts
app/api/dashboard/withdrawals/route.ts
```

## Implementation Order

The frontend is split into 4 independent sub-plans:
1. **Plan A: Scaffold + Landing page** — Next.js setup, Tailwind theme, shared components, full landing page
2. **Plan B: Marketplace** — 3-column agent registry with filters, cards, feed, modal
3. **Plan C: Onboarding wizard** — 3-step role/framework/wallet flow
4. **Plan D: Builder Dashboard** — Agent management, earnings, wallet, API keys

Each plan produces a working, viewable page. They can be built and shipped independently.

## Testing Strategy

No unit tests for this phase — the frontend is a direct port of validated HTML mockups. Correctness is verified by:
1. Visual comparison against the HTML mockups
2. `next build` succeeds with no errors
3. All pages render without JS errors in the browser
4. API routes return expected data from the SDK

E2E tests (Playwright) are deferred to a future phase.

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS 3 (custom dark theme)
- TypeScript
- `agntly` SDK (workspace dependency)
- Google Fonts (IBM Plex Mono, Figtree, DM Sans)

## Environment Variables

```env
AGNTLY_API_KEY=ag_live_sk_...
AGNTLY_API_URL=http://localhost:3005
```
