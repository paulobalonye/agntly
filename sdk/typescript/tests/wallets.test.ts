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
  const client = new HttpClient({ apiKey: 'ag_test_key', baseUrl: 'http://localhost:3002' });
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
