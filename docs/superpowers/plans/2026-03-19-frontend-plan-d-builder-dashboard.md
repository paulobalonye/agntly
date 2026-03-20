# Plan D: Builder Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the builder dashboard page where agent developers manage their agents, track earnings, view task history, manage wallet/withdrawals, and handle API keys.

**Architecture:** Server component fetches initial data via BFF API routes that proxy to multiple backend services. Dashboard uses the same dark theme and component patterns as the marketplace. Data sections are separate client components for interactive features (withdraw, create key, etc.).

**Tech Stack:** Next.js 14, Tailwind CSS, TypeScript

---

## File Structure

```
frontend/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx              ← Dashboard page
│   │   └── layout.tsx            ← Dashboard layout (reuses marketplace nav)
│   └── api/
│       └── dashboard/
│           ├── overview/route.ts ← Aggregated stats
│           ├── agents/route.ts   ← Builder's agents
│           ├── tasks/route.ts    ← Recent tasks
│           └── wallet/route.ts   ← Wallet + withdrawals
└── components/
    └── dashboard/
        ├── OverviewCards.tsx      ← 4 stat cards
        ├── EarningsChart.tsx      ← SVG bar chart (simulated data)
        ├── MyAgentsTable.tsx      ← Agent list with metrics
        ├── RecentTasks.tsx        ← Task history table
        ├── WalletSection.tsx      ← Balance + withdraw form
        └── ApiKeysSection.tsx     ← Key management
```

---

## Task 1: Dashboard API routes

**Files:**
- Create: `frontend/app/api/dashboard/overview/route.ts`
- Create: `frontend/app/api/dashboard/agents/route.ts`
- Create: `frontend/app/api/dashboard/tasks/route.ts`
- Create: `frontend/app/api/dashboard/wallet/route.ts`

These BFF routes proxy to backend services. Since services use in-memory data and we don't have per-user filtering yet, the routes return mock/simulated data that matches the dashboard design.

**overview/route.ts** — Returns aggregated stats:
```json
{
  "totalEarned": "1,240.50",
  "earningsToday": "47.82",
  "activeAgents": 3,
  "avgRating": 4.91
}
```

**agents/route.ts** — Proxies to registry-service GET /v1/agents (returns all agents for now — per-user filtering comes when auth is wired to backend).

**tasks/route.ts** — Returns simulated recent task data (array of 10 mock tasks with agent name, amount, status, timestamp).

**wallet/route.ts** — Returns simulated wallet data (balance, locked, address, recent withdrawals).

All routes return the standard `{ success, data, error }` envelope.

**After implementing:**
```bash
git add frontend/app/api/dashboard/
git commit -m "feat: add dashboard BFF API routes"
```

---

## Task 2: OverviewCards + EarningsChart

**Files:**
- Create: `frontend/components/dashboard/OverviewCards.tsx`
- Create: `frontend/components/dashboard/EarningsChart.tsx`

**OverviewCards.tsx** — 4 stat cards in a row:
- Total Earned (green, large number) — `$1,240.50`
- Earnings Today (blue) — `$47.82`
- Active Agents (amber) — `3`
- Avg Rating (purple) — `4.91 / 5`

Each card: `bg-bg-1 border border-border p-5` with monospace label, large display number, and delta indicator.

**EarningsChart.tsx** — Client component. SVG bar chart showing last 14 days of earnings. Uses simulated data (random values between $10-$80 per day). Each bar: green fill, hover shows tooltip with date + amount. X-axis: day labels. Y-axis: dollar amounts.

Bar chart style: thin bars with 2px gap, green fill matching accent color, monospace axis labels in t-2 color.

**After implementing:**
```bash
git add frontend/components/dashboard/OverviewCards.tsx frontend/components/dashboard/EarningsChart.tsx
git commit -m "feat: add dashboard overview cards and earnings chart"
```

---

## Task 3: MyAgentsTable + RecentTasks

**Files:**
- Create: `frontend/components/dashboard/MyAgentsTable.tsx`
- Create: `frontend/components/dashboard/RecentTasks.tsx`

**MyAgentsTable.tsx** — Table showing builder's agents. Columns: Name (with colored icon), Status (pill), Price, Calls/24h, Earnings/24h, Uptime. Rows are clickable. Uses data from `/api/dashboard/agents`.

Table style: `bg-bg-1 border border-border`, header row with monospace uppercase labels in t-2, data rows with hover highlight, monospace numbers.

**RecentTasks.tsx** — Table showing last 20 tasks handled by the builder's agents. Columns: Task ID (monospace, truncated), Agent, Amount (green), Status (pill), Time (relative). Uses simulated data.

Status pills: complete=green, failed=red, disputed=amber, escrowed=blue.

**After implementing:**
```bash
git add frontend/components/dashboard/MyAgentsTable.tsx frontend/components/dashboard/RecentTasks.tsx
git commit -m "feat: add MyAgentsTable and RecentTasks dashboard components"
```

---

## Task 4: WalletSection + ApiKeysSection

**Files:**
- Create: `frontend/components/dashboard/WalletSection.tsx`
- Create: `frontend/components/dashboard/ApiKeysSection.tsx`

**WalletSection.tsx** — Client component. Shows:
- Balance card: large green number, locked amount below, wallet address (monospace, truncated with copy button)
- Withdraw form: amount input + destination input + "withdraw" button. On submit, POSTs to `/api/dashboard/wallet` (simulated for now). Shows success/error state.
- Recent withdrawals: small table with amount, destination (truncated), status pill, txHash link, date.

**ApiKeysSection.tsx** — Client component. Shows:
- List of API keys: prefix (monospace, e.g., `ag_live_sk_...`), label, last used date, revoke button
- "Create new key" form: label input + create button. On create, shows the full key ONCE with a copy button and warning "This key won't be shown again."
- Uses simulated data (2-3 mock keys).

**After implementing:**
```bash
git add frontend/components/dashboard/WalletSection.tsx frontend/components/dashboard/ApiKeysSection.tsx
git commit -m "feat: add WalletSection and ApiKeysSection dashboard components"
```

---

## Task 5: Dashboard layout + page assembly

**Files:**
- Create: `frontend/app/dashboard/layout.tsx`
- Create: `frontend/app/dashboard/page.tsx`

**layout.tsx** — Reuses MarketplaceNav (with "dashboard" link styled as active instead of "registry"). Wraps with nav + footer.

To make the nav link highlighting work, the MarketplaceNav component needs to know which page is active. The simplest approach: pass a prop or check `usePathname()`. Since MarketplaceNav is already built, the dashboard layout can import it and the nav will show — the active link styling is a minor enhancement (can use pathname check).

**page.tsx** — Dashboard page layout:
```
┌──────────────────────────────────────────┐
│              MarketplaceNav              │
├──────────────────────────────────────────┤
│  OverviewCards (4 cards in a row)        │
├───────────────────┬──────────────────────┤
│  EarningsChart    │  WalletSection       │
│  (2/3 width)      │  (1/3 width)         │
├───────────────────┴──────────────────────┤
│  MyAgentsTable (full width)              │
├──────────────────────────────────────────┤
│  RecentTasks (full width)                │
├──────────────────────────────────────────┤
│  ApiKeysSection (full width)             │
├──────────────────────────────────────────┤
│              Footer                      │
└──────────────────────────────────────────┘
```

Page heading: "Builder Dashboard" with monospace eyebrow label "dashboard" in accent color.

Each section has a heading (monospace, uppercase, t-2 color, letter-spaced) with a bottom border separator.

**After implementing:**
1. Build: `cd /Users/drpraize/agntly/frontend && pnpm build`
2. Commit:
```bash
git add frontend/app/dashboard/
git commit -m "feat: assemble builder dashboard page with all sections"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Dashboard API routes | 4 BFF route files |
| 2 | Overview cards + earnings chart | 2 components |
| 3 | Agents table + tasks table | 2 components |
| 4 | Wallet section + API keys | 2 components (client, interactive) |
| 5 | Layout + page assembly | 2 files |

**Total: 5 tasks, ~12 files.**
