# Plan B2: Marketplace Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 3-column agent marketplace page ported from `marketplace.html` — left sidebar with filters, center grid of agent cards, right panel with live feed and leaderboard. Connected to real agent data via BFF API route → registry-service.

**Architecture:** Server component fetches agents via a Next.js API route that proxies to registry-service. Client components handle interactive elements: search/filter state, sort buttons, agent detail modal, simulated live feed. The page is protected by the auth middleware from Plan B1.

**Tech Stack:** Next.js 14, Tailwind CSS, TypeScript

**Source mockup:** `/Users/drpraize/agntly/marketplace.html`

---

## File Structure

```
frontend/
├── app/
│   ├── marketplace/
│   │   ├── page.tsx              ← Marketplace page (server component, fetches agents)
│   │   └── layout.tsx            ← Marketplace layout (nav + stats bar + footer)
│   └── api/
│       └── agents/
│           ├── route.ts          ← GET: proxy to registry-service
│           └── [id]/
│               └── route.ts      ← GET: proxy single agent
└── components/
    └── marketplace/
        ├── MarketplaceNav.tsx    ← Full nav with tickers
        ├── StatsBar.tsx          ← 5-cell stat strip
        ├── FilterSidebar.tsx     ← Categories, status, price, search
        ├── AgentCard.tsx         ← Individual agent card
        ├── AgentGrid.tsx         ← Grid + sort + search (client component)
        ├── AgentModal.tsx        ← Detail modal with code snippet
        ├── ActivityFeed.tsx      ← Live settlement feed (simulated)
        ├── Leaderboard.tsx       ← Top earners table
        └── SparklineChart.tsx    ← SVG sparkline
```

---

## Task 1: API routes for agents

**Files:**
- Create: `frontend/app/api/agents/route.ts`
- Create: `frontend/app/api/agents/[id]/route.ts`

These BFF routes proxy to the registry-service. They pass query params through for filtering/sorting.

**`app/api/agents/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${REGISTRY_URL}/v1/agents${searchParams ? '?' + searchParams : ''}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

**`app/api/agents/[id]/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await fetch(`${REGISTRY_URL}/v1/agents/${encodeURIComponent(id)}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

**After implementing:**
```bash
git add frontend/app/api/agents/
git commit -m "feat: add BFF API routes for agent registry"
```

---

## Task 2: MarketplaceNav + StatsBar + SparklineChart

**Files:**
- Create: `frontend/components/marketplace/MarketplaceNav.tsx`
- Create: `frontend/components/marketplace/StatsBar.tsx`
- Create: `frontend/components/marketplace/SparklineChart.tsx`

Port directly from `marketplace.html`. The nav has: logo, nav links (registry active, my_agents, wallet, docs, analytics), tickers (tasks/24h, volume, avg fee), connect wallet + list agent buttons.

**MarketplaceNav.tsx** — matches the `<nav>` from marketplace.html. Use simulated ticker values (static for now). Client component for ticker animation.

**StatsBar.tsx** — 5-cell stat strip: registered agents (2,847), tasks settled today (94,201), total volume ($1.24M), avg task latency (1.8s), settlement chain (Base L2). Static values matching the mockup.

**SparklineChart.tsx** — SVG sparkline for the right panel volume chart. Client component that generates random data points and renders a polyline + fill. Matches the sparkline from marketplace.html.

Style reference: All components use the same color/font system from `tailwind.config.ts` (bg-0, bg-1, border, t-0, t-1, t-2, accent, font-mono, font-display).

**After implementing:**
```bash
git add frontend/components/marketplace/MarketplaceNav.tsx frontend/components/marketplace/StatsBar.tsx frontend/components/marketplace/SparklineChart.tsx
git commit -m "feat: add MarketplaceNav, StatsBar, and SparklineChart"
```

---

## Task 3: AgentCard + AgentModal

**Files:**
- Create: `frontend/components/marketplace/AgentCard.tsx`
- Create: `frontend/components/marketplace/AgentModal.tsx`

Port the agent card and modal from `marketplace.html`.

**AgentCard.tsx** — receives an agent object as props. Renders:
- Card header: colored icon square (2-letter abbreviation) + agent name + agent ID + status pill (online/busy/offline)
- Description text
- Tags row (first tag highlighted in blue)
- 3-metric row: calls/24h, uptime, latency (calculated from agent data)
- Footer: price in USDC + "connect →" button
- Featured badge (if `featuredUntil` is in the future)
- Click handler calls `onSelect(agent)`

Map agent category to display properties:
```typescript
const CATEGORY_COLORS: Record<string, { color: string; bg: string; abbr: string }> = {
  search: { color: '#4d9ef5', bg: 'rgba(77,158,245,0.12)', abbr: 'WS' },
  code: { color: '#9b7cf8', bg: 'rgba(155,124,248,0.12)', abbr: 'CE' },
  file: { color: '#00e5a0', bg: 'rgba(0,229,160,0.12)', abbr: 'PP' },
  data: { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', abbr: 'DW' },
  api: { color: '#e05252', bg: 'rgba(224,82,82,0.12)', abbr: 'AR' },
  llm: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', abbr: 'SC' },
};
```

**AgentModal.tsx** — client component. Receives selected agent + `onClose`. Renders:
- Modal overlay (dark backdrop, blur)
- Agent header: large icon + name + ID + author + verified since
- Description
- 6-metric grid (price, calls/24h, uptime, latency, rating, total earned)
- Code snippet (Python quickstart with the actual agent ID embedded)
- Action buttons: connect agent, view docs, copy sdk snippet
- Click outside or × to close

The code snippet:
```python
# pip install agntly
from agntly import Agntly

agntly = Agntly(api_key="ag_live_...")
result = agntly.run(
    agent_id="{agent.id}",
    payload={{ "query": "your input here" }},
    budget="{agent.priceUsdc}",
)
# result.data → structured output
# result.tx_hash → settlement proof
```

**After implementing:**
```bash
git add frontend/components/marketplace/AgentCard.tsx frontend/components/marketplace/AgentModal.tsx
git commit -m "feat: add AgentCard and AgentModal components"
```

---

## Task 4: FilterSidebar + AgentGrid (interactive client components)

**Files:**
- Create: `frontend/components/marketplace/FilterSidebar.tsx`
- Create: `frontend/components/marketplace/AgentGrid.tsx`

**FilterSidebar.tsx** — client component. Receives `onFilterChange` callback. Contains:
- Search input
- Category filters (all, web search, code executor, data processor, file/doc, API caller, LLM wrapper) with counts and colored dots
- Status filters (online, busy)
- Price range slider
- Reputation filters (verified only, top rated)
- Active filter highlighted with green left border

State managed internally, calls `onFilterChange({ category, status, maxPrice, q })` on any change.

**AgentGrid.tsx** — client component. The main orchestrator for the center column:
- Receives initial agents from server component
- Header: "showing N agents" count + sort buttons (volume, price, rating, newest)
- Grid: `grid-cols-[repeat(auto-fill,minmax(300px,1fr))]`
- Renders `AgentCard` for each agent
- Manages selected agent state for modal
- Manages filter/sort state
- Fetches filtered agents from `/api/agents?category=X&sort=Y` when filters change
- Shows `AgentModal` when an agent is selected

**After implementing:**
```bash
git add frontend/components/marketplace/FilterSidebar.tsx frontend/components/marketplace/AgentGrid.tsx
git commit -m "feat: add FilterSidebar and AgentGrid with search, filter, sort"
```

---

## Task 5: ActivityFeed + Leaderboard (right panel)

**Files:**
- Create: `frontend/components/marketplace/ActivityFeed.tsx`
- Create: `frontend/components/marketplace/Leaderboard.tsx`

**ActivityFeed.tsx** — client component with simulated live data (same pattern as marketplace.html JS). Shows settlement events: agent name, amount (+$0.0020 or -$0.0010), description (Task completed / Escrow locked), time ago. Auto-rotates every 3 seconds, adding new random events and aging existing ones.

**Leaderboard.tsx** — static component showing top 5 earners. Receives agents sorted by a mock `earnings24h` value. Renders: rank number, colored icon, agent name, earnings amount in green.

Both match the right panel from marketplace.html.

**After implementing:**
```bash
git add frontend/components/marketplace/ActivityFeed.tsx frontend/components/marketplace/Leaderboard.tsx
git commit -m "feat: add ActivityFeed and Leaderboard for marketplace right panel"
```

---

## Task 6: Marketplace layout + page assembly

**Files:**
- Create: `frontend/app/marketplace/layout.tsx`
- Create: `frontend/app/marketplace/page.tsx`

**layout.tsx** — wraps marketplace pages with:
- MarketplaceNav at top
- StatsBar below nav
- `{children}` in the middle
- Footer at bottom

**page.tsx** — the main marketplace page. Assembles the 3-column layout:
```
┌──────────────────────────────────────────────────────┐
│                   MarketplaceNav                      │
│                     StatsBar                          │
├───────────┬──────────────────────┬───────────────────┤
│           │                      │                   │
│  Filter   │    AgentGrid         │   ActivityFeed    │
│  Sidebar  │    (cards + sort)    │   Leaderboard     │
│  220px    │    flex              │   Sparkline       │
│           │                      │   280px           │
│           │                      │                   │
├───────────┴──────────────────────┴───────────────────┤
│                      Footer                           │
└──────────────────────────────────────────────────────┘
```

The page is a server component that fetches initial agents from `/api/agents` and passes them to the client `AgentGrid`. The sidebar, right panel, and grid are arranged with CSS grid: `grid-template-columns: 220px 1fr 280px`.

**After implementing:**
1. Build: `cd /Users/drpraize/agntly/frontend && pnpm build`
2. Verify: `pnpm dev` → open http://localhost:3100/marketplace (should redirect to login first, then marketplace after auth)
3. Commit:
```bash
git add frontend/app/marketplace/
git commit -m "feat: assemble marketplace page with 3-column layout"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | BFF API routes for agents | 2 API route files |
| 2 | Nav + stats bar + sparkline | 3 components |
| 3 | Agent card + detail modal | 2 components |
| 4 | Filter sidebar + agent grid | 2 components (client, interactive) |
| 5 | Activity feed + leaderboard | 2 components (client, simulated data) |
| 6 | Layout + page assembly | 2 files (layout + page) |

**Total: 6 tasks, ~13 files. Direct port of marketplace.html into React components.**
