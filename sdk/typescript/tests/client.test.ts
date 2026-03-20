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
    const errorResponse = jsonResponse(
      { success: false, data: null, error: 'Wallet not found' },
      400,
    );
    mockFetch.mockResolvedValueOnce(errorResponse);
    mockFetch.mockResolvedValueOnce(errorResponse);
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
