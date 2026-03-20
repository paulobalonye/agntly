const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
const DISPATCH_TIMEOUT_MS = 30_000;

export async function dispatchToAgent(
  agentId: string,
  taskId: string,
  payload: Record<string, unknown>,
): Promise<{ result: Record<string, unknown> | null; error: string | null }> {
  // 1. Get agent details from registry
  let agent: { endpoint: string } | null = null;
  try {
    const res = await fetch(`${REGISTRY_URL}/v1/agents/${encodeURIComponent(agentId)}`);
    if (!res.ok) return { result: null, error: `Agent ${agentId} not found` };
    const data = await res.json() as { data: { endpoint: string } };
    agent = data.data;
  } catch {
    return { result: null, error: `Failed to lookup agent ${agentId}` };
  }

  // 2. Call agent endpoint with timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const res = await fetch(agent.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agntly-Task-Id': taskId,
      },
      body: JSON.stringify({ taskId, payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { result: null, error: `Agent returned ${res.status}` };
    }

    const result = await res.json() as Record<string, unknown>;
    return { result, error: null };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : 'Agent dispatch failed';
    return { result: null, error: message };
  }
}
