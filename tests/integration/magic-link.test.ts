import { describe, it, expect, beforeEach } from 'vitest';
import { MagicLinkService } from '../../services/auth-service/src/services/magic-link-service.js';
import { AuthService } from '../../services/auth-service/src/services/auth-service.js';
import type { IResendClient } from '../../services/auth-service/src/services/resend-client.js';
import type { DbConnection } from '@agntly/shared';

// ---------------------------------------------------------------------------
// Mock Resend client
// ---------------------------------------------------------------------------
class MockResendClient implements IResendClient {
  sentEmails: { email: string; token: string }[] = [];

  async sendMagicLink(email: string, token: string): Promise<void> {
    this.sentEmails.push({ email, token });
  }
}

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------
interface Row {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Mock repository implementations — avoids real DB dependency in unit tests.
// ---------------------------------------------------------------------------
class MockUserRepository {
  private readonly users: Map<string, Row> = new Map();
  private readonly emailIndex: Map<string, string> = new Map();
  private seq = 0;

  async create(data: { email: string; passwordHash: string; role?: string }): Promise<Row> {
    const id = `user-${++this.seq}`;
    const row: Row = {
      id,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? 'developer',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, row);
    this.emailIndex.set(data.email, id);
    return row;
  }

  async findById(id: string): Promise<Row | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<Row | null> {
    const id = this.emailIndex.get(email);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async upsertByEmail(email: string, role?: string): Promise<Row> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    return this.create({ email, passwordHash: '', role: role ?? 'developer' });
  }
}

class MockMagicLinkRepository {
  private readonly tokens: Map<string, Row> = new Map();
  private readonly sends: Array<{ email: string; createdAt: Date }> = [];
  private seq = 0;

  async create(data: { email: string; tokenHash: string; expiresAt: Date }): Promise<Row> {
    const id = `ml-${++this.seq}`;
    const createdAt = new Date();
    const row: Row = {
      id,
      email: data.email,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdAt,
    };
    this.tokens.set(data.tokenHash, row);
    this.sends.push({ email: data.email, createdAt });
    return row;
  }

  async findByTokenHash(tokenHash: string): Promise<Row | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  async markUsed(tokenHash: string): Promise<string | null> {
    const stored = this.tokens.get(tokenHash);
    const now = new Date();
    if (!stored || stored['usedAt'] !== null || (stored['expiresAt'] as Date) <= now) {
      return null;
    }
    const updated = { ...stored, usedAt: now };
    this.tokens.set(tokenHash, updated);
    return stored['id'] as string;
  }

  async countRecentByEmail(email: string, windowMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - windowMs);
    return this.sends.filter((s) => s.email === email && s.createdAt > cutoff).length;
  }

  async deleteExpired(): Promise<number> {
    return 0;
  }

  /** Test helper: expire a token so verifyMagicLink sees it as expired. */
  forceExpire(tokenHash: string): void {
    const stored = this.tokens.get(tokenHash);
    if (stored) {
      this.tokens.set(tokenHash, { ...stored, expiresAt: new Date(Date.now() - 1000) });
    }
  }
}

// ---------------------------------------------------------------------------
// Factory that wires real service classes with mock repositories injected.
// A bare `{}` is passed as the DB because the services only pass it through
// to repositories — and we replace the repositories immediately after.
// ---------------------------------------------------------------------------
function makeServices() {
  const fakeDb = {} as DbConnection;

  const authService = new AuthService(fakeDb);
  const userRepo = new MockUserRepository();
  (authService as unknown as { userRepo: MockUserRepository }).userRepo = userRepo;

  const mockResend = new MockResendClient();
  const magicLinkService = new MagicLinkService(authService, mockResend, fakeDb);
  const magicLinkRepo = new MockMagicLinkRepository();
  (magicLinkService as unknown as { magicLinkRepo: MockMagicLinkRepository }).magicLinkRepo = magicLinkRepo;

  return { authService, magicLinkService, mockResend, magicLinkRepo, userRepo };
}

// ---------------------------------------------------------------------------
// Use unique emails per test to avoid shared state leakage.
// ---------------------------------------------------------------------------
let emailCounter = 0;
function uniqueEmail(prefix = 'test'): string {
  emailCounter += 1;
  return `${prefix}-${emailCounter}-${Date.now()}@example.com`;
}

describe('MagicLinkService integration tests', () => {
  beforeEach(() => {
    // emailCounter increments per test via uniqueEmail() — no shared service state to clear
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
    const { magicLinkService, mockResend, magicLinkRepo } = makeServices();
    const email = uniqueEmail('verify-expired');

    await magicLinkService.sendMagicLink(email);
    const { token } = mockResend.sentEmails[0]!;

    // Force-expire the token via the mock repo's test helper
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    magicLinkRepo.forceExpire(tokenHash);

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
