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
