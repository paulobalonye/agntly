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
  const client = new HttpClient({ apiKey: 'ag_test_key', baseUrl: 'http://localhost:3004' });
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
