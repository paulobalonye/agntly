import { describe, it, expect, beforeEach } from 'vitest';
import { MagicLinkService } from '../../services/auth-service/src/services/magic-link-service.js';
import { AuthService } from '../../services/auth-service/src/services/auth-service.js';
import type { IResendClient } from '../../services/auth-service/src/services/resend-client.js';

class MockResendClient implements IResendClient {
  sentEmails: { email: string; token: string }[] = [];

  async sendMagicLink(email: string, token: string): Promise<void> {
    this.sentEmails.push({ email, token });
  }
}

function makeServices(): { magicLinkService: MagicLinkService; mockResend: MockResendClient } {
  const authService = new AuthService();
  const mockResend = new MockResendClient();
  const magicLinkService = new MagicLinkService(authService, mockResend);
  return { magicLinkService, mockResend };
}

// Use unique emails per test to avoid module-level Map state leakage in AuthService
let emailCounter = 0;
function uniqueEmail(prefix = 'test'): string {
  emailCounter += 1;
  return `${prefix}-${emailCounter}-${Date.now()}@example.com`;
}

describe('MagicLinkService integration tests', () => {
  beforeEach(() => {
    // emailCounter increments per test via uniqueEmail() calls — no shared service state to clear
  });

  it('1. sendMagicLink records email in mock', async () => {
    const { magicLinkService, mockResend } = makeServices();
    const email = uniqueEmail('send-records');

    await magicLinkService.sendMagicLink(email);

    expect(mockResend.sentEmails).toHaveLength(1);
    expect(mockResend.sentEmails[0]!.email).toBe(email);
  });

  it('2. verifyMagicLink with valid token returns JWT + user', async () => {
    const { magicLinkService, mockResend } = makeServices();
    const email = uniqueEmail('verify-valid');

    await magicLinkService.sendMagicLink(email);
    const { token } = mockResend.sentEmails[0]!;

    const result = await magicLinkService.verifyMagicLink(token);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe(email);
    expect(typeof result.accessToken).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(0);
  });

  it('3. verifyMagicLink with expired token throws', async () => {
    const { magicLinkService, mockResend } = makeServices();
    const email = uniqueEmail('verify-expired');

    await magicLinkService.sendMagicLink(email);
    const { token } = mockResend.sentEmails[0]!;

    // Access private tokens Map to manipulate the stored entry's expiry
    const tokensMap = (magicLinkService as unknown as { tokens: Map<string, { email: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; createdAt: Date }> }).tokens;
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = tokensMap.get(tokenHash);
    if (!stored) throw new Error('Token not found in internal map');

    // Create a new object with past expiry and replace in map (immutable pattern — create new entry)
    const expiredEntry = { ...stored, expiresAt: new Date(Date.now() - 1000) };
    tokensMap.set(tokenHash, expiredEntry);

    await expect(magicLinkService.verifyMagicLink(token)).rejects.toThrow('Magic link expired');
  });

  it('4. verifyMagicLink with already-used token throws', async () => {
    const { magicLinkService, mockResend } = makeServices();
    const email = uniqueEmail('verify-used');

    await magicLinkService.sendMagicLink(email);
    const { token } = mockResend.sentEmails[0]!;

    // First verification succeeds
    await expect(magicLinkService.verifyMagicLink(token)).resolves.toHaveProperty('accessToken');

    // Second verification with the same token should throw
    await expect(magicLinkService.verifyMagicLink(token)).rejects.toThrow('Magic link already used');
  });

  it('5. verifyMagicLink with non-existent token throws', async () => {
    const { magicLinkService } = makeServices();
    const fakeToken = 'a'.repeat(64); // 64-char hex string that was never stored

    await expect(magicLinkService.verifyMagicLink(fakeToken)).rejects.toThrow('Invalid magic link');
  });

  it('6. sendMagicLink for new email auto-creates user with developer role', async () => {
    const { magicLinkService, mockResend } = makeServices();
    const email = uniqueEmail('auto-create');

    await magicLinkService.sendMagicLink(email);
    const { token } = mockResend.sentEmails[0]!;

    const result = await magicLinkService.verifyMagicLink(token);

    expect(result.user.email).toBe(email);
    expect(result.user.role).toBe('developer');
    expect(typeof result.user.id).toBe('string');
    expect(result.user.id.length).toBeGreaterThan(0);
  });

  it('7. rate limit: 4th request to same email throws Too many requests', async () => {
    const { magicLinkService } = makeServices();
    const email = uniqueEmail('rate-limit');

    // First 3 requests should succeed
    await magicLinkService.sendMagicLink(email);
    await magicLinkService.sendMagicLink(email);
    await magicLinkService.sendMagicLink(email);

    // 4th request should throw rate limit error
    await expect(magicLinkService.sendMagicLink(email)).rejects.toThrow('Too many requests');
  });
});
