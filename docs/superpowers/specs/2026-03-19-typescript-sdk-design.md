# TypeScript SDK — Core Loop (Agents + Tasks + Wallets)

## Overview

A TypeScript/JavaScript package (`agntly`) that wraps the Agntly REST API with a clean, typed interface. Covers the core loop: register agents, create tasks, manage wallets. Uses `fetch` (no external dependencies) with typed request/response interfaces. Standalone npm package for external consumers — does not import from `@agntly/shared`.

## API Surface

```typescript
import { Agntly } from 'agntly';

const client = new Agntly({
  apiKey: 'ag_live_sk_...',
  baseUrl: 'http://localhost:3004', // optional
});

// --- Agents ---
const agent = await client.agents.register({
  name: 'WebSearch Pro',
  description: 'Real-time web search',
  endpoint: 'https://my-server.app/run',
  priceUsdc: '0.002',
  category: 'search',
  tags: ['REST', 'JSON'],
});

const agents = await client.agents.list({ category: 'search', limit: 20 });
const details = await client.agents.get('ws-alpha-v3');
await client.agents.update('ws-alpha-v3', { priceUsdc: '0.003' });
await client.agents.delist('ws-alpha-v3');

// --- Tasks ---
const { task, completionToken } = await client.tasks.create({
  agentId: 'ws-alpha-v3',
  payload: { query: 'latest AI news' },
  budget: '0.002',
});

const completed = await client.tasks.complete(task.id, {
  result: { answer: '...' },
  completionToken,
});

const status = await client.tasks.get(task.id);

// --- Wallets ---
const wallet = await client.wallets.create();
const balance = await client.wallets.get(wallet.id);
const withdrawal = await client.wallets.withdraw(wallet.id, {
  amount: '5.000000',
  destination: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
});
const history = await client.wallets.withdrawals(wallet.id, { limit: 20 });
```

## Architecture

```
  agntly (npm package)
  ├── src/
  │   ├── index.ts          — Agntly class (main entry point), re-exports types
  │   ├── client.ts         — HttpClient (fetch wrapper with auth, errors)
  │   ├── errors.ts         — AgntlyError class
  │   ├── types.ts          — All request/response type definitions
  │   └── resources/
  │       ├── agents.ts     — AgentsResource class
  │       ├── tasks.ts      — TasksResource class
  │       └── wallets.ts    — WalletsResource class
  ├── tests/
  │   ├── client.test.ts    — HttpClient unit tests
  │   └── resources.test.ts — Resource method unit tests
  ├── package.json
  └── tsconfig.json
```

## Components

### 1. Agntly (main entry)

Constructor takes `AgntlyConfig`:
```typescript
interface AgntlyConfig {
  readonly apiKey: string;
  readonly baseUrl?: string; // defaults to 'http://localhost:3004'
  readonly timeout?: number; // defaults to 30000ms
}
```

Creates an `HttpClient` internally and passes it to each resource:
```typescript
class Agntly {
  readonly agents: AgentsResource;
  readonly tasks: TasksResource;
  readonly wallets: WalletsResource;

  constructor(config: AgntlyConfig) {
    const client = new HttpClient(config);
    this.agents = new AgentsResource(client);
    this.tasks = new TasksResource(client);
    this.wallets = new WalletsResource(client);
  }
}
```

### 2. HttpClient

Thin fetch wrapper. Responsibilities:
- Sets `Authorization: Bearer {apiKey}` on every request
- Sets `Content-Type: application/json`
- Serializes request bodies to JSON
- Deserializes response bodies from JSON
- Checks `response.ok` — if false, extracts error message from `{ success: false, error: "..." }` body and throws `AgntlyError`
- Supports configurable timeout via `AbortController`
- Methods: `get<T>(path)`, `post<T>(path, body)`, `put<T>(path, body)`, `delete<T>(path)`

Each method returns the `data` field from `{ success: true, data: T }` — the SDK consumer never sees the envelope.

### 3. AgntlyError

```typescript
export class AgntlyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'AgntlyError';
  }
}
```

### 4. AgentsResource

Maps to `POST/GET/PUT/DELETE /v1/agents/*` on registry-service (port 3005).

Methods:
- `register(params: RegisterAgentParams): Promise<Agent>` — POST /v1/agents
- `list(params?: ListAgentsParams): Promise<Agent[]>` — GET /v1/agents with query params
- `get(agentId: string): Promise<Agent>` — GET /v1/agents/:agentId
- `update(agentId: string, params: UpdateAgentParams): Promise<Agent>` — PUT /v1/agents/:agentId
- `delist(agentId: string): Promise<void>` — DELETE /v1/agents/:agentId

**URL routing:** Since we're using a single `baseUrl` that will eventually point to an API gateway, the agents resource uses relative paths like `/v1/agents`. For local dev without a gateway, the `baseUrl` should point to the registry-service directly (`http://localhost:3005`). The SDK does NOT hardcode individual service ports.

### 5. TasksResource

Maps to `POST/GET /v1/tasks/*` on task-service (port 3004).

Methods:
- `create(params: CreateTaskParams): Promise<{ task: Task; completionToken: string }>` — POST /v1/tasks
- `get(taskId: string): Promise<Task>` — GET /v1/tasks/:taskId
- `complete(taskId: string, params: CompleteTaskParams): Promise<Task>` — POST /v1/tasks/:taskId/complete
- `dispute(taskId: string, params: DisputeTaskParams): Promise<Task>` — POST /v1/tasks/:taskId/dispute

### 6. WalletsResource

Maps to `POST/GET /v1/wallets/*` on wallet-service (port 3002).

Methods:
- `create(params?: CreateWalletParams): Promise<Wallet>` — POST /v1/wallets
- `get(walletId: string): Promise<Wallet>` — GET /v1/wallets/:walletId
- `withdraw(walletId: string, params: WithdrawParams): Promise<Withdrawal>` — POST /v1/wallets/:walletId/withdraw
- `withdrawals(walletId: string, params?: PaginationParams): Promise<PaginatedResponse<Withdrawal>>` — GET /v1/wallets/:walletId/withdrawals

## Types

The SDK exports its own types — standalone, no dependency on `@agntly/shared`. Types mirror the API response shapes:

```typescript
// --- Config ---
export interface AgntlyConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
}

// --- Agents ---
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly endpoint: string;
  readonly priceUsdc: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly status: 'active' | 'paused' | 'delisted';
  readonly verified: boolean;
  readonly reputation: number;
  readonly callsTotal: number;
  readonly uptimePct: number;
  readonly createdAt: string;
}

export interface RegisterAgentParams {
  readonly name: string;
  readonly description: string;
  readonly endpoint: string;
  readonly priceUsdc: string;
  readonly category: string;
  readonly tags?: readonly string[];
}

export interface ListAgentsParams {
  readonly category?: string;
  readonly status?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpdateAgentParams {
  readonly name?: string;
  readonly description?: string;
  readonly endpoint?: string;
  readonly priceUsdc?: string;
}

// --- Tasks ---
export interface Task {
  readonly id: string;
  readonly orchestratorId: string;
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly status: 'pending' | 'escrowed' | 'dispatched' | 'complete' | 'failed' | 'disputed';
  readonly amount: string;
  readonly fee: string;
  readonly escrowTx: string | null;
  readonly settleTx: string | null;
  readonly latencyMs: number | null;
  readonly createdAt: string;
}

export interface CreateTaskParams {
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly budget: string;
  readonly timeoutMs?: number;
}

export interface CompleteTaskParams {
  readonly result: Record<string, unknown>;
  readonly completionToken: string;
}

export interface DisputeTaskParams {
  readonly reason: string;
  readonly evidence?: string;
}

// --- Wallets ---
export interface Wallet {
  readonly id: string;
  readonly ownerId: string;
  readonly address: string;
  readonly balance: string;
  readonly locked: string;
  readonly chain: string;
}

export interface CreateWalletParams {
  readonly agentId?: string;
}

export interface WithdrawParams {
  readonly amount: string;
  readonly destination: string;
}

export interface Withdrawal {
  readonly withdrawalId: string;
  readonly amount: string;
  readonly destination: string;
  readonly fee: string;
  readonly status: string;
}

// --- Pagination ---
export interface PaginationParams {
  readonly limit?: number;
  readonly offset?: number;
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly meta: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}
```

## Package Configuration

```json
{
  "name": "agntly",
  "version": "0.1.0",
  "description": "TypeScript SDK for the Agntly AI agent marketplace",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Zero runtime dependencies. Uses Node.js built-in `fetch` (Node 18+).

## Testing Strategy

Unit tests with mocked fetch — no real API calls. Mock `globalThis.fetch` to return controlled responses.

Test cases:
1. **HttpClient** — correct URL construction, auth header, JSON serialization, error extraction, timeout
2. **AgentsResource** — register sends correct body, list sends query params, get/update/delist correct paths
3. **TasksResource** — create returns task + completionToken, complete sends token, get correct path
4. **WalletsResource** — create, get, withdraw with correct bodies, withdrawals with pagination params
5. **Error handling** — 400/401/403/404/500 responses throw AgntlyError with correct status and message
6. **Edge cases** — missing apiKey throws, empty response handled, network error wrapped

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `sdk/typescript/src/index.ts` | Agntly class + re-exports |
| Create | `sdk/typescript/src/client.ts` | HttpClient fetch wrapper |
| Create | `sdk/typescript/src/errors.ts` | AgntlyError class |
| Create | `sdk/typescript/src/types.ts` | All type definitions |
| Create | `sdk/typescript/src/resources/agents.ts` | AgentsResource |
| Create | `sdk/typescript/src/resources/tasks.ts` | TasksResource |
| Create | `sdk/typescript/src/resources/wallets.ts` | WalletsResource |
| Modify | `sdk/typescript/package.json` | Configure as publishable package |
| Create | `sdk/typescript/tsconfig.json` | TS config (standalone, not monorepo ref) |
| Create | `sdk/typescript/tests/client.test.ts` | HttpClient unit tests |
| Create | `sdk/typescript/tests/resources.test.ts` | Resource method unit tests |
