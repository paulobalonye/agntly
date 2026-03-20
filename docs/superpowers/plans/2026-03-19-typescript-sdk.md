# TypeScript SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `agntly` TypeScript SDK package that wraps the Agntly REST API with typed methods for agents, tasks, and wallets — the "3 lines of code" developer experience.

**Architecture:** `Agntly` main class creates an `HttpClient` (fetch wrapper with auth, errors, pagination) and passes it to three resource classes (`AgentsResource`, `TasksResource`, `WalletsResource`). Zero runtime dependencies — uses native `fetch`. Standalone npm package, does not import from `@agntly/shared`.

**Tech Stack:** TypeScript 5.7, native fetch (Node 18+), Vitest for unit tests

---

## File Structure

### SDK package (`sdk/typescript/`)
- `package.json` — Publishable npm package config
- `tsconfig.json` — Standalone TS config
- `src/index.ts` — Agntly class + re-exports
- `src/client.ts` — HttpClient with auth, errors, pagination, timeout
- `src/errors.ts` — AgntlyError class
- `src/types.ts` — All request/response type definitions
- `src/resources/agents.ts` — AgentsResource
- `src/resources/tasks.ts` — TasksResource
- `src/resources/wallets.ts` — WalletsResource
- `tests/client.test.ts` — HttpClient unit tests
- `tests/agents.test.ts` — AgentsResource tests
- `tests/tasks.test.ts` — TasksResource tests
- `tests/wallets.test.ts` — WalletsResource tests

---

## Task 1: Package setup + types + errors

**Files:**
- Create: `sdk/typescript/package.json`
- Create: `sdk/typescript/tsconfig.json`
- Create: `sdk/typescript/src/types.ts`
- Create: `sdk/typescript/src/errors.ts`

- [ ] **Step 1: Create package.json**

Create `sdk/typescript/package.json`:

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

- [ ] **Step 2: Create tsconfig.json**

Create `sdk/typescript/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["dist", "tests"]
}
```

- [ ] **Step 3: Create errors.ts**

Create `sdk/typescript/src/errors.ts`:

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

- [ ] **Step 4: Create types.ts**

Create `sdk/typescript/src/types.ts`:

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
  readonly ownerId: string;
  readonly walletId: string;
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
  readonly timeoutMs: number;
  readonly createdAt: string;
}

export interface RegisterAgentParams {
  readonly agentId: string;
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
  readonly category?: string;
  readonly tags?: readonly string[];
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
  readonly deadline: string;
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
  readonly proof?: string;
}

export interface DisputeTaskParams {
  readonly reason: string;
  readonly evidence?: string;
}

// --- Wallets ---
export interface Wallet {
  readonly id: string;
  readonly ownerId: string;
  readonly agentId: string | null;
  readonly address: string;
  readonly balance: string;
  readonly locked: string;
  readonly chain: string;
}

export interface CreateWalletParams {
  readonly agentId?: string;
}

export interface FundWalletParams {
  readonly amountUsd: number;
  readonly method: 'card' | 'ach' | 'usdc';
}

export interface FundResult {
  readonly depositId: string;
  readonly amountUsd: number;
  readonly usdcAmount: string;
  readonly status: string;
  readonly etaSeconds: number;
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

- [ ] **Step 5: Install deps and verify build**

Run: `cd /Users/drpraize/agntly/sdk/typescript && pnpm install && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add sdk/typescript/package.json sdk/typescript/tsconfig.json sdk/typescript/src/types.ts sdk/typescript/src/errors.ts
git commit -m "feat: scaffold SDK package with types and error class"
```

---

## Task 2: HttpClient with auth, errors, pagination, timeout

**Files:**
- Create: `sdk/typescript/src/client.ts`
- Create: `sdk/typescript/tests/client.test.ts`

- [ ] **Step 1: Create client.ts**

Create `sdk/typescript/src/client.ts`:

```typescript
import { AgntlyError } from './errors.js';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    if (!config.apiKey) {
      throw new AgntlyError('apiKey is required', 0);
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://sandbox.api.agntly.io').replace(/\/$/, '');
    this.timeout = config.timeout ?? 30_000;
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.request<T>(url, { method: 'GET' });
  }

  async getPaginated<T>(path: string, query?: Record<string, string | number | undefined>): Promise<{ data: readonly T[]; meta: { total: number; limit: number; offset: number } }> {
    const url = this.buildUrl(path, query);
    return this.requestRaw<{ data: readonly T[]; meta: { total: number; limit: number; offset: number } }>(url, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(this.buildUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(this.buildUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(path: string): Promise<T> {
    return this.request<T>(this.buildUrl(path), { method: 'DELETE' });
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /**
   * Standard request — strips the { success, data, error } envelope, returns `data`.
   */
  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const envelope = await this.requestRaw<{ success: boolean; data: T; error: string | null }>(url, init);
    return envelope.data;
  }

  /**
   * Raw request — returns the full parsed JSON body (used for paginated responses
   * where we need both `data` and `meta`).
   */
  private async requestRaw<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...init.headers,
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AgntlyError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw new AgntlyError(
        err instanceof Error ? err.message : 'Network error',
        0,
      );
    }

    clearTimeout(timer);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let body: unknown;
      try {
        body = await response.json();
        if (body && typeof body === 'object' && 'error' in body) {
          errorMessage = (body as { error: string }).error;
        }
      } catch {
        // Non-JSON error body (e.g., HTML from load balancer)
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new AgntlyError(errorMessage, response.status, body);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new AgntlyError('Invalid JSON response', response.status);
    }
  }
}
```

- [ ] **Step 2: Create client tests**

Create `sdk/typescript/tests/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../src/client.js';
import { AgntlyError } from '../src/errors.js';

const mockFetch = vi.fn();

beforeEach(() => {
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    headers: new Headers(),
  } as unknown as Response;
}

describe('HttpClient', () => {
  it('should throw if apiKey is empty', () => {
    expect(() => new HttpClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('should set Authorization header on every request', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { id: '1' }, error: null }));
    const client = new HttpClient({ apiKey: 'ag_test_key', baseUrl: 'http://localhost:3000' });

    await client.get('/v1/test');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0]!;
    expect(init.headers.Authorization).toBe('Bearer ag_test_key');
  });

  it('should build URL with query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: [], error: null }));
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    await client.get('/v1/agents', { category: 'search', limit: 10, skip: undefined });

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('category=search');
    expect(url).toContain('limit=10');
    expect(url).not.toContain('skip');
  });

  it('should strip envelope and return data field', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: { id: 'agent_1', name: 'Test' },
      error: null,
    }));
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    const result = await client.get<{ id: string; name: string }>('/v1/agents/1');

    expect(result).toEqual({ id: 'agent_1', name: 'Test' });
  });

  it('should return full body for getPaginated', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      data: [{ id: '1' }, { id: '2' }],
      error: null,
      meta: { total: 5, limit: 2, offset: 0 },
    }));
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    const result = await client.getPaginated<{ id: string }>('/v1/agents');

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(5);
  });

  it('should throw AgntlyError on 400 with error message', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(
      { success: false, data: null, error: 'Wallet not found' },
      400,
    ));
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    await expect(client.get('/v1/wallets/bad')).rejects.toThrow(AgntlyError);
    await expect(client.get('/v1/wallets/bad')).rejects.toThrow('Wallet not found');
  });

  it('should handle non-JSON error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 502, statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('not json')),
      headers: new Headers(),
    } as unknown as Response);
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    try {
      await client.get('/v1/test');
    } catch (err) {
      expect(err).toBeInstanceOf(AgntlyError);
      expect((err as AgntlyError).status).toBe(502);
      expect((err as AgntlyError).message).toContain('502');
    }
  });

  it('should wrap network errors as AgntlyError with status 0', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    try {
      await client.get('/v1/test');
    } catch (err) {
      expect(err).toBeInstanceOf(AgntlyError);
      expect((err as AgntlyError).status).toBe(0);
      expect((err as AgntlyError).message).toBe('Failed to fetch');
    }
  });

  it('should send POST with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: { id: '1' }, error: null }));
    const client = new HttpClient({ apiKey: 'key', baseUrl: 'http://localhost:3000' });

    await client.post('/v1/tasks', { agentId: 'a1', payload: {} });

    const [, init] = mockFetch.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ agentId: 'a1', payload: {} });
  });

  it('should use default baseUrl when not provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: {}, error: null }));
    const client = new HttpClient({ apiKey: 'key' });

    await client.get('/v1/test');

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('sandbox.api.agntly.io');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/drpraize/agntly/sdk/typescript && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add sdk/typescript/src/client.ts sdk/typescript/tests/client.test.ts
git commit -m "feat: add HttpClient with auth, error handling, pagination, and timeout"
```

---

## Task 3: AgentsResource + tests

**Files:**
- Create: `sdk/typescript/src/resources/agents.ts`
- Create: `sdk/typescript/tests/agents.test.ts`

- [ ] **Step 1: Create agents.ts**

Create `sdk/typescript/src/resources/agents.ts`:

```typescript
import type { HttpClient } from '../client.js';
import type {
  Agent,
  RegisterAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
  PaginatedResponse,
} from '../types.js';

export class AgentsResource {
  constructor(private readonly client: HttpClient) {}

  async register(params: RegisterAgentParams): Promise<Agent> {
    return this.client.post<Agent>('/v1/agents', params);
  }

  async list(params?: ListAgentsParams): Promise<PaginatedResponse<Agent>> {
    return this.client.getPaginated<Agent>('/v1/agents', params as Record<string, string | number | undefined>);
  }

  async get(agentId: string): Promise<Agent> {
    return this.client.get<Agent>(`/v1/agents/${encodeURIComponent(agentId)}`);
  }

  async update(agentId: string, params: UpdateAgentParams): Promise<Agent> {
    return this.client.put<Agent>(`/v1/agents/${encodeURIComponent(agentId)}`, params);
  }

  async delist(agentId: string): Promise<{ delisted: boolean }> {
    return this.client.del<{ delisted: boolean }>(`/v1/agents/${encodeURIComponent(agentId)}`);
  }
}
```

- [ ] **Step 2: Create agents tests**

Create `sdk/typescript/tests/agents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../src/client.js';
import { AgentsResource } from '../src/resources/agents.js';

const mockFetch = vi.fn();
beforeEach(() => { globalThis.fetch = mockFetch; });
afterEach(() => { vi.restoreAllMocks(); });

function ok(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data, error: null }) } as unknown as Response;
}
function okPaginated(data: unknown[], meta: { total: number; limit: number; offset: number }) {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data, error: null, meta }) } as unknown as Response;
}

describe('AgentsResource', () => {
  const client = new HttpClient({ apiKey: 'test', baseUrl: 'http://localhost:3005' });
  const agents = new AgentsResource(client);

  it('register sends agentId and body', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'my-agent', name: 'Test' }));
    const result = await agents.register({
      agentId: 'my-agent', name: 'Test', description: 'desc',
      endpoint: 'https://test.com/run', priceUsdc: '0.002', category: 'search',
    });
    expect(result.id).toBe('my-agent');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.agentId).toBe('my-agent');
  });

  it('list sends query params and returns paginated', async () => {
    mockFetch.mockResolvedValueOnce(okPaginated(
      [{ id: '1' }, { id: '2' }],
      { total: 10, limit: 2, offset: 0 },
    ));
    const result = await agents.list({ category: 'search', limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(10);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('category=search');
    expect(url).toContain('limit=2');
  });

  it('get fetches by agent ID', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'ws-alpha', name: 'WebSearch' }));
    const result = await agents.get('ws-alpha');
    expect(result.name).toBe('WebSearch');
    expect(mockFetch.mock.calls[0]![0]).toContain('/v1/agents/ws-alpha');
  });

  it('update sends PUT with partial body', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'ws-alpha', priceUsdc: '0.005' }));
    await agents.update('ws-alpha', { priceUsdc: '0.005' });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(init.method).toBe('PUT');
    expect(url).toContain('/v1/agents/ws-alpha');
  });

  it('delist sends DELETE and returns confirmation', async () => {
    mockFetch.mockResolvedValueOnce(ok({ delisted: true }));
    const result = await agents.delist('ws-alpha');
    expect(result.delisted).toBe(true);
    expect(mockFetch.mock.calls[0]![1].method).toBe('DELETE');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/drpraize/agntly/sdk/typescript && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add sdk/typescript/src/resources/agents.ts sdk/typescript/tests/agents.test.ts
git commit -m "feat: add AgentsResource with register, list, get, update, delist"
```

---

## Task 4: TasksResource + tests

**Files:**
- Create: `sdk/typescript/src/resources/tasks.ts`
- Create: `sdk/typescript/tests/tasks.test.ts`

- [ ] **Step 1: Create tasks.ts**

Create `sdk/typescript/src/resources/tasks.ts`:

```typescript
import type { HttpClient } from '../client.js';
import type { Task, CreateTaskParams, CompleteTaskParams, DisputeTaskParams } from '../types.js';

export class TasksResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a task. The server returns a flat object { ...taskFields, completionToken }.
   * We reshape it into { task, completionToken } for a cleaner API.
   */
  async create(params: CreateTaskParams): Promise<{ task: Task; completionToken: string }> {
    const raw = await this.client.post<Record<string, unknown>>('/v1/tasks', params);
    const { completionToken, ...taskFields } = raw;
    return {
      task: taskFields as unknown as Task,
      completionToken: completionToken as string,
    };
  }

  async get(taskId: string): Promise<Task> {
    return this.client.get<Task>(`/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  async complete(taskId: string, params: CompleteTaskParams): Promise<Task> {
    return this.client.post<Task>(`/v1/tasks/${encodeURIComponent(taskId)}/complete`, params);
  }

  async dispute(taskId: string, params: DisputeTaskParams): Promise<Task> {
    return this.client.post<Task>(`/v1/tasks/${encodeURIComponent(taskId)}/dispute`, params);
  }
}
```

- [ ] **Step 2: Create tasks tests**

Create `sdk/typescript/tests/tasks.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../src/client.js';
import { TasksResource } from '../src/resources/tasks.js';

const mockFetch = vi.fn();
beforeEach(() => { globalThis.fetch = mockFetch; });
afterEach(() => { vi.restoreAllMocks(); });

function ok(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data, error: null }) } as unknown as Response;
}

describe('TasksResource', () => {
  const client = new HttpClient({ apiKey: 'test', baseUrl: 'http://localhost:3004' });
  const tasks = new TasksResource(client);

  it('create reshapes flat response into { task, completionToken }', async () => {
    mockFetch.mockResolvedValueOnce(ok({
      id: 'tsk_123', agentId: 'ws-alpha', status: 'pending',
      amount: '0.002', completionToken: 'ctk_abc123',
    }));

    const { task, completionToken } = await tasks.create({
      agentId: 'ws-alpha', payload: { query: 'test' }, budget: '0.002',
    });

    expect(task.id).toBe('tsk_123');
    expect(task.status).toBe('pending');
    expect(completionToken).toBe('ctk_abc123');
    // completionToken should NOT be on the task object
    expect((task as any).completionToken).toBeUndefined();
  });

  it('get fetches task by ID', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'tsk_123', status: 'complete' }));
    const task = await tasks.get('tsk_123');
    expect(task.status).toBe('complete');
    expect(mockFetch.mock.calls[0]![0]).toContain('/v1/tasks/tsk_123');
  });

  it('complete sends completionToken and proof', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'tsk_123', status: 'complete' }));
    await tasks.complete('tsk_123', {
      result: { answer: 'done' },
      completionToken: 'ctk_abc',
      proof: 'hash123',
    });
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.completionToken).toBe('ctk_abc');
    expect(body.proof).toBe('hash123');
  });

  it('dispute sends reason', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'tsk_123', status: 'disputed' }));
    await tasks.dispute('tsk_123', { reason: 'Bad output' });
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.reason).toBe('Bad output');
    expect(mockFetch.mock.calls[0]![0]).toContain('/v1/tasks/tsk_123/dispute');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/drpraize/agntly/sdk/typescript && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add sdk/typescript/src/resources/tasks.ts sdk/typescript/tests/tasks.test.ts
git commit -m "feat: add TasksResource with create (reshape), get, complete, dispute"
```

---

## Task 5: WalletsResource + tests

**Files:**
- Create: `sdk/typescript/src/resources/wallets.ts`
- Create: `sdk/typescript/tests/wallets.test.ts`

- [ ] **Step 1: Create wallets.ts**

Create `sdk/typescript/src/resources/wallets.ts`:

```typescript
import type { HttpClient } from '../client.js';
import type {
  Wallet,
  CreateWalletParams,
  FundWalletParams,
  FundResult,
  WithdrawParams,
  Withdrawal,
  PaginationParams,
  PaginatedResponse,
} from '../types.js';

export class WalletsResource {
  constructor(private readonly client: HttpClient) {}

  async create(params?: CreateWalletParams): Promise<Wallet> {
    return this.client.post<Wallet>('/v1/wallets', params ?? {});
  }

  async get(walletId: string): Promise<Wallet> {
    return this.client.get<Wallet>(`/v1/wallets/${encodeURIComponent(walletId)}`);
  }

  async fund(walletId: string, params: FundWalletParams): Promise<FundResult> {
    return this.client.post<FundResult>(`/v1/wallets/${encodeURIComponent(walletId)}/fund`, params);
  }

  async withdraw(walletId: string, params: WithdrawParams): Promise<Withdrawal> {
    return this.client.post<Withdrawal>(`/v1/wallets/${encodeURIComponent(walletId)}/withdraw`, params);
  }

  async withdrawals(walletId: string, params?: PaginationParams): Promise<PaginatedResponse<Withdrawal>> {
    return this.client.getPaginated<Withdrawal>(
      `/v1/wallets/${encodeURIComponent(walletId)}/withdrawals`,
      params as Record<string, string | number | undefined>,
    );
  }
}
```

- [ ] **Step 2: Create wallets tests**

Create `sdk/typescript/tests/wallets.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../src/client.js';
import { WalletsResource } from '../src/resources/wallets.js';

const mockFetch = vi.fn();
beforeEach(() => { globalThis.fetch = mockFetch; });
afterEach(() => { vi.restoreAllMocks(); });

function ok(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data, error: null }) } as unknown as Response;
}
function okPaginated(data: unknown[], meta: { total: number; limit: number; offset: number }) {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data, error: null, meta }) } as unknown as Response;
}

describe('WalletsResource', () => {
  const client = new HttpClient({ apiKey: 'test', baseUrl: 'http://localhost:3002' });
  const wallets = new WalletsResource(client);

  it('create sends POST with optional agentId', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'wal_1', balance: '0.000000' }));
    const wallet = await wallets.create({ agentId: 'my-agent' });
    expect(wallet.id).toBe('wal_1');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.agentId).toBe('my-agent');
  });

  it('get fetches wallet by ID', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'wal_1', balance: '50.000000' }));
    const wallet = await wallets.get('wal_1');
    expect(wallet.balance).toBe('50.000000');
  });

  it('fund sends amount and method', async () => {
    mockFetch.mockResolvedValueOnce(ok({
      depositId: 'dep_1', amountUsd: 10, usdcAmount: '9.850000', status: 'confirmed', etaSeconds: 30,
    }));
    const result = await wallets.fund('wal_1', { amountUsd: 10, method: 'card' });
    expect(result.usdcAmount).toBe('9.850000');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.method).toBe('card');
    expect(mockFetch.mock.calls[0]![0]).toContain('/v1/wallets/wal_1/fund');
  });

  it('withdraw sends amount and destination', async () => {
    mockFetch.mockResolvedValueOnce(ok({
      withdrawalId: 'wth_1', amount: '5.000000', destination: '0xabc', fee: '0.000000', status: 'queued',
    }));
    const result = await wallets.withdraw('wal_1', {
      amount: '5.000000', destination: '0xabc',
    });
    expect(result.status).toBe('queued');
    expect(mockFetch.mock.calls[0]![0]).toContain('/v1/wallets/wal_1/withdraw');
  });

  it('withdrawals returns paginated response with meta', async () => {
    mockFetch.mockResolvedValueOnce(okPaginated(
      [{ withdrawalId: 'wth_1' }, { withdrawalId: 'wth_2' }],
      { total: 5, limit: 2, offset: 0 },
    ));
    const result = await wallets.withdrawals('wal_1', { limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(5);
    expect(result.meta.limit).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/drpraize/agntly/sdk/typescript && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add sdk/typescript/src/resources/wallets.ts sdk/typescript/tests/wallets.test.ts
git commit -m "feat: add WalletsResource with create, get, fund, withdraw, withdrawals"
```

---

## Task 6: Agntly main class + index exports

**Files:**
- Create: `sdk/typescript/src/index.ts`

- [ ] **Step 1: Create index.ts**

Create `sdk/typescript/src/index.ts`:

```typescript
import { HttpClient } from './client.js';
import { AgentsResource } from './resources/agents.js';
import { TasksResource } from './resources/tasks.js';
import { WalletsResource } from './resources/wallets.js';
import type { AgntlyConfig } from './types.js';

export class Agntly {
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

// Re-export everything consumers need
export { AgntlyError } from './errors.js';
export type {
  AgntlyConfig,
  Agent,
  RegisterAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
  Task,
  CreateTaskParams,
  CompleteTaskParams,
  DisputeTaskParams,
  Wallet,
  CreateWalletParams,
  FundWalletParams,
  FundResult,
  WithdrawParams,
  Withdrawal,
  PaginationParams,
  PaginatedResponse,
} from './types.js';
```

- [ ] **Step 2: Verify full build + all tests**

Run: `cd /Users/drpraize/agntly/sdk/typescript && pnpm build && npx vitest run`
Expected: Build succeeds, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add sdk/typescript/src/index.ts
git commit -m "feat: add Agntly main class with agents, tasks, wallets resources"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Package scaffold + types + errors | `package.json`, `tsconfig.json`, `types.ts`, `errors.ts` |
| 2 | HttpClient (auth, errors, pagination, timeout) | `client.ts`, `tests/client.test.ts` |
| 3 | AgentsResource (register, list, get, update, delist) | `resources/agents.ts`, `tests/agents.test.ts` |
| 4 | TasksResource (create with reshape, get, complete, dispute) | `resources/tasks.ts`, `tests/tasks.test.ts` |
| 5 | WalletsResource (create, get, fund, withdraw, withdrawals) | `resources/wallets.ts`, `tests/wallets.test.ts` |
| 6 | Agntly main class + re-exports | `index.ts` |

**Total: 6 tasks, 12 files, zero runtime dependencies.**

**Key correctness properties:**
- `tasks.create()` reshapes flat server response into `{ task, completionToken }` (prevents destructuring bug)
- `getPaginated()` preserves `meta` for pagination endpoints
- Network errors wrapped as `AgntlyError(status: 0)` — single error type for consumers
- `apiKey` validated at construction time — fails fast
- All resource methods encode path parameters with `encodeURIComponent`
