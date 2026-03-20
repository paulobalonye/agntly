import crypto from 'crypto';
import type { DbConnection } from '@agntly/shared';
import { AuthService } from './auth-service.js';
import type { IResendClient } from './resend-client.js';
import { MagicLinkRepository } from '../repositories/magic-link-repository.js';

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class MagicLinkService {
  private readonly magicLinkRepo: MagicLinkRepository;

  constructor(
    private readonly authService: AuthService,
    private readonly resendClient: IResendClient,
    db: DbConnection,
  ) {
    this.magicLinkRepo = new MagicLinkRepository(db);
  }

  async sendMagicLink(email: string): Promise<void> {
    await this.enforceRateLimit(email);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await this.magicLinkRepo.create({ email, tokenHash, expiresAt });

    // Ensure user exists (auto-create on first login)
    await this.authService.getOrCreateUser(email);

    await this.resendClient.sendMagicLink(email, rawToken);
  }

  async verifyMagicLink(token: string): Promise<ReturnType<AuthService['generateTokens']>> {
    const tokenHash = hashToken(token);

    // Atomic CAS: only succeeds if token exists, is unused, and not expired
    const updatedId = await this.magicLinkRepo.markUsed(tokenHash);

    if (!updatedId) {
      // Distinguish between "not found", "already used", and "expired" for better error messages
      const stored = await this.magicLinkRepo.findByTokenHash(tokenHash);

      if (!stored) {
        throw new Error('Invalid magic link');
      }

      if (stored.usedAt !== null) {
        throw new Error('Magic link already used');
      }

      throw new Error('Magic link expired');
    }

    const stored = await this.magicLinkRepo.findByTokenHash(tokenHash);
    if (!stored) {
      throw new Error('Magic link token not found after mark used');
    }

    const user = await this.authService.getOrCreateUser(stored.email);
    return this.authService.generateTokens(user);
  }

  private async enforceRateLimit(email: string): Promise<void> {
    const count = await this.magicLinkRepo.countRecentByEmail(email, RATE_LIMIT_WINDOW_MS);
    if (count >= RATE_LIMIT_MAX) {
      throw new Error('Too many requests: please wait before requesting another magic link');
    }
  }
}
