import { createHmac, timingSafeEqual } from 'node:crypto';

function getCompletionSecret(): string {
  const secret = process.env.COMPLETION_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: COMPLETION_TOKEN_SECRET env var is required and must be at least 32 characters');
    process.exit(1);
  }
  return secret;
}

const COMPLETION_SECRET: string = getCompletionSecret();

export function generateCompletionToken(taskId: string, agentId: string): string {
  const payload = `${taskId}:${agentId}`;
  const hmac = createHmac('sha256', COMPLETION_SECRET).update(payload).digest('hex');
  return `ctk_${hmac}`;
}

export function verifyCompletionToken(
  token: string,
  taskId: string,
  agentId: string,
): boolean {
  if (!token.startsWith('ctk_')) return false;

  const expected = generateCompletionToken(taskId, agentId);

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}
