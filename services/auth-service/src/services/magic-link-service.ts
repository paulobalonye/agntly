// TODO: SECURITY — Magic link tokens stored in-memory. Must migrate to magic_link_tokens
// PostgreSQL table before production. In-memory means: tokens lost on restart, rate
// limits per-instance only, no horizontal scaling.
import crypto from 'crypto';
import { AuthService } from './auth-service.js';
import type { IResendClient } from './resend-client.js';

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3;

interface StoredToken {
  readonly email: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  usedAt: Date | null;
  readonly createdAt: Date;
}

interface RateLimitEntry {
  readonly sends: Date[];
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class MagicLinkService {
  private readonly tokens = new Map<string, StoredToken>(); // tokenHash → StoredToken
  private readonly rateLimits = new Map<string, RateLimitEntry>(); // email → entry

  constructor(
    private readonly authService: AuthService,
    private readonly resendClient: IResendClient,
  ) {}

  async sendMagicLink(email: string): Promise<void> {
    this.enforceRateLimit(email);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    const stored: StoredToken = {
      email,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };

    this.tokens.set(tokenHash, stored);
    this.recordSend(email);

    // Ensure user exists (auto-create on first login)
    this.authService.getOrCreateUser(email);

    await this.resendClient.sendMagicLink(email, rawToken);
  }

  async verifyMagicLink(token: string): Promise<ReturnType<AuthService['generateTokens']>> {
    const tokenHash = hashToken(token);
    const stored = this.tokens.get(tokenHash);

    if (!stored) {
      throw new Error('Invalid magic link');
    }

    if (stored.usedAt !== null) {
      throw new Error('Magic link already used');
    }

    if (stored.expiresAt < new Date()) {
      throw new Error('Magic link expired');
    }

    // Mark as used (in-place assignment is acceptable here since this is a controlled mutation
    // of the stored entry's single mutable field, not a structural mutation of the Map itself)
    stored.usedAt = new Date();

    const user = this.authService.getOrCreateUser(stored.email);
    return this.authService.generateTokens(user);
  }

  private enforceRateLimit(email: string): void {
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    const entry = this.rateLimits.get(email);

    if (!entry) return;

    const recentSends = entry.sends.filter((d) => d > windowStart);

    if (recentSends.length >= RATE_LIMIT_MAX) {
      throw new Error('Too many requests: please wait before requesting another magic link');
    }
  }

  private recordSend(email: string): void {
    const now = new Date();
    const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    const existing = this.rateLimits.get(email);

    const previousSends = existing ? existing.sends.filter((d) => d > windowStart) : [];
    const updatedEntry: RateLimitEntry = { sends: [...previousSends, now] };
    this.rateLimits.set(email, updatedEntry);
  }
}
