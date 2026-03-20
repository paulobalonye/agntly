# Delight Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 delight features that make Agntly feel alive and polished — live settlement feed, agent quickstart code, earnings alerts, on-chain receipt links, and GitHub health badges.

**Architecture:** Each feature is independent — they can be built and shipped in any order. Most add 1-2 files to existing services with no architectural changes.

**Tech Stack:** SSE (Server-Sent Events), SVG generation, Redis Streams, existing services

---

## Task 1: On-chain Receipt Links

The simplest delight feature. Every task completion and withdrawal already returns a `txHash` or `settleTx`. Add a `receiptUrl` field that links to BaseScan.

**Files:**
- Create: `shared/src/utils/receipt.ts`
- Modify: `shared/src/index.ts` — export receipt util

**receipt.ts:**
```typescript
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';
const BASE_MAINNET_EXPLORER = 'https://basescan.org';

export function getReceiptUrl(txHash: string | null, chain: string = 'base-sepolia'): string | null {
  if (!txHash) return null;
  const explorer = chain === 'base' ? BASE_MAINNET_EXPLORER : BASE_SEPOLIA_EXPLORER;
  return `${explorer}/tx/${txHash}`;
}
```

This is a utility that services can call when returning task/withdrawal responses. Services already return `txHash` — now they can also return `receiptUrl: getReceiptUrl(txHash)`. The actual service integration is done by adding `receiptUrl` to response objects wherever `txHash` is returned.

**After implementing:**
```bash
git add shared/src/utils/receipt.ts shared/src/index.ts
git commit -m "feat: add on-chain receipt URL generator for BaseScan links"
```

---

## Task 2: Agent Health Badge

A dynamic SVG endpoint that agents can embed in their GitHub README: `![Agntly](https://sandbox.api.agntly.io/v1/agents/ws-alpha-v3/badge.svg)`

Shows: agent name, uptime %, price per call, and rating.

**Files:**
- Create: `services/registry-service/src/routes/badge.ts`
- Modify: `services/registry-service/src/server.ts` — register badge route

**badge.ts** — Fastify route that returns `Content-Type: image/svg+xml`:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { RegistryService } from '../services/registry-service.js';

export const badgeRoutes: FastifyPluginAsync = async (app) => {
  const registryService = new RegistryService();

  app.get('/:agentId/badge.svg', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await registryService.getAgent(agentId);

    if (!agent) {
      // Return a "not found" badge
      const svg = generateBadge('agntly', 'not found', '#e05252');
      return reply.type('image/svg+xml').header('Cache-Control', 'no-cache').send(svg);
    }

    const label = 'agntly';
    const value = `${agent.uptimePct}% · $${agent.priceUsdc}/call · ★${agent.reputation.toFixed(1)}`;
    const color = agent.uptimePct >= 99 ? '#00e5a0' : agent.uptimePct >= 95 ? '#f5a623' : '#e05252';
    const svg = generateBadge(label, value, color);

    return reply
      .type('image/svg+xml')
      .header('Cache-Control', 'public, max-age=300') // Cache 5 min
      .send(svg);
  });
};

function generateBadge(label: string, value: string, color: string): string {
  const labelWidth = label.length * 7 + 12;
  const valueWidth = value.length * 6.5 + 12;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <rect width="${labelWidth}" height="20" fill="#0d1117"/>
  <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}20" stroke="${color}40" stroke-width="0.5"/>
  <text x="${labelWidth / 2}" y="14" fill="#00e5a0" font-family="monospace" font-size="11" text-anchor="middle">${label}</text>
  <text x="${labelWidth + valueWidth / 2}" y="14" fill="${color}" font-family="monospace" font-size="10" text-anchor="middle">${value}</text>
</svg>`;
}
```

Register in server.ts under the `/v1/agents` prefix so the URL is `/v1/agents/:agentId/badge.svg`.

**After implementing:**
```bash
git add services/registry-service/src/routes/badge.ts services/registry-service/src/server.ts
git commit -m "feat: add dynamic SVG health badge for agent GitHub READMEs"
```

---

## Task 3: Agent Quickstart Generator

When an agent is registered, auto-generate personalized code snippets for Python and TypeScript that include the agent's actual ID and price. Return these in the registration response.

**Files:**
- Create: `shared/src/utils/quickstart.ts`
- Modify: `shared/src/index.ts` — export quickstart

**quickstart.ts:**
```typescript
export function generateQuickstart(agentId: string, priceUsdc: string): { python: string; typescript: string; curl: string } {
  return {
    python: `# pip install agntly
from agntly import Agntly

agntly = Agntly(api_key="ag_live_...")
result = agntly.tasks.create(
    agent_id="${agentId}",
    payload={"query": "your input here"},
    budget="${priceUsdc}",
)
# result["task"]["status"] → "complete"
# result["task"]["result"] → agent output`,

    typescript: `// npm install agntly
import { Agntly } from 'agntly';

const client = new Agntly({ apiKey: 'ag_live_...' });
const { task } = await client.tasks.create({
  agentId: '${agentId}',
  payload: { query: 'your input here' },
  budget: '${priceUsdc}',
});
// task.result → agent output
// task.settleTx → on-chain proof`,

    curl: `curl -X POST https://sandbox.api.agntly.io/v1/tasks \\
  -H "Authorization: Bearer ag_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${agentId}",
    "payload": {"query": "your input here"},
    "budget": "${priceUsdc}"
  }'`,
  };
}
```

The registry-service's `registerAgent` response can include `quickstart: generateQuickstart(agent.id, agent.priceUsdc)` — but that's a service-level change that can be done later. For now, the utility is available for any consumer.

**After implementing:**
```bash
git add shared/src/utils/quickstart.ts shared/src/index.ts
git commit -m "feat: add agent quickstart code generator for Python, TypeScript, and curl"
```

---

## Task 4: Live Settlement Feed (SSE)

Server-Sent Events endpoint that streams real-time settlement events to the marketplace UI. The marketplace's ActivityFeed component currently uses simulated data — this connects it to real events.

**Files:**
- Create: `services/webhook-service/src/routes/feed.ts`
- Modify: `services/webhook-service/src/server.ts` — register feed route + track SSE clients

The webhook-service already subscribes to all Redis Stream events. Add an SSE endpoint that pushes events to connected browser clients.

**feed.ts:**
```typescript
import type { FastifyPluginAsync } from 'fastify';

interface SSEClient {
  id: string;
  reply: any;
}

const clients: SSEClient[] = [];
let clientIdCounter = 0;

export function broadcastEvent(event: { type: string; data: Record<string, unknown>; timestamp: string }): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (let i = clients.length - 1; i >= 0; i--) {
    try {
      clients[i]!.reply.raw.write(payload);
    } catch {
      clients.splice(i, 1); // Remove dead client
    }
  }
}

export const feedRoutes: FastifyPluginAsync = async (app) => {
  app.get('/feed', async (request, reply) => {
    const clientId = `sse_${++clientIdCounter}`;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    clients.push({ id: clientId, reply });

    // Remove client on disconnect
    request.raw.on('close', () => {
      const idx = clients.findIndex(c => c.id === clientId);
      if (idx !== -1) clients.splice(idx, 1);
    });

    // Keep connection open — don't call reply.send()
  });
};
```

In `server.ts`, after the event consumer processes an event and delivers webhooks, also call `broadcastEvent(message)` to push to SSE clients.

The frontend marketplace can then replace the simulated ActivityFeed with:
```typescript
const eventSource = new EventSource('/api/feed');
eventSource.onmessage = (e) => {
  const event = JSON.parse(e.data);
  // Add to feed
};
```

(Frontend integration is a follow-up — this task just adds the SSE endpoint.)

**After implementing:**
```bash
git add services/webhook-service/src/routes/feed.ts services/webhook-service/src/server.ts
git commit -m "feat: add Server-Sent Events endpoint for live settlement feed"
```

---

## Task 5: Earnings Alerts

When an agent earns USDC (task.completed event), automatically deliver a webhook to the agent builder if they have a subscription for `task.completed`. The webhook service already does this — this task is about making the event payload include earnings-specific fields that make the notification useful.

**Files:**
- Create: `shared/src/utils/earnings.ts`
- Modify: `shared/src/index.ts` — export earnings util

**earnings.ts:**
```typescript
export interface EarningsAlert {
  readonly agentId: string;
  readonly agentName: string;
  readonly taskId: string;
  readonly earned: string;
  readonly fee: string;
  readonly net: string;
  readonly totalToday: string;
  readonly receiptUrl: string | null;
}

export function formatEarningsAlert(data: {
  agentId: string;
  agentName: string;
  taskId: string;
  amount: string;
  fee: string;
  txHash: string | null;
  chain?: string;
  totalToday?: string;
}): EarningsAlert {
  const earned = data.amount;
  const fee = data.fee;
  const net = (parseFloat(earned) - parseFloat(fee)).toFixed(6);
  const receiptUrl = data.txHash
    ? `https://sepolia.basescan.org/tx/${data.txHash}`
    : null;

  return {
    agentId: data.agentId,
    agentName: data.agentName,
    taskId: data.taskId,
    earned,
    fee,
    net,
    totalToday: data.totalToday ?? net,
    receiptUrl,
  };
}
```

This utility formats `task.completed` event data into a rich earnings alert payload. The webhook service can use it when delivering `task.completed` webhooks to include `net`, `totalToday`, and `receiptUrl` — making the webhook payload useful for notifications (email, Telegram, Discord).

**After implementing:**
```bash
git add shared/src/utils/earnings.ts shared/src/index.ts
git commit -m "feat: add earnings alert formatter with receipt URLs and daily totals"
```

---

## Summary

| Task | Feature | Files | Effort |
|------|---------|-------|--------|
| 1 | On-chain Receipt Links | `shared/src/utils/receipt.ts` | 10 min |
| 2 | Agent Health Badge | `registry-service/src/routes/badge.ts` | 20 min |
| 3 | Agent Quickstart Generator | `shared/src/utils/quickstart.ts` | 10 min |
| 4 | Live Settlement Feed (SSE) | `webhook-service/src/routes/feed.ts` | 20 min |
| 5 | Earnings Alerts | `shared/src/utils/earnings.ts` | 10 min |

**Total: 5 tasks, ~8 files. All independent — can be built in parallel.**
