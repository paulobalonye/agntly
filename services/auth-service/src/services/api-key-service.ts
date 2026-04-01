import { randomBytes, createHash } from 'node:crypto';
import type { DbConnection } from '@agntly/shared';
import { ApiKeyRepository } from '../repositories/api-key-repository.js';

interface PublicKeyRow {
  readonly id: string;
  readonly userId: string;
  readonly prefix: string;
  readonly label: string;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export class ApiKeyService {
  private readonly apiKeyRepo: ApiKeyRepository;

  constructor(db: DbConnection) {
    this.apiKeyRepo = new ApiKeyRepository(db);
  }

  async createKey(userId: string, label: string): Promise<{ key: string; id: string; prefix: string; label: string }> {
    const envTag = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const rawKey = `ag_${envTag}_sk_${randomBytes(24).toString('hex')}`;
    const prefix = rawKey.slice(0, 14);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const stored = await this.apiKeyRepo.create({ userId, keyHash, prefix, label });
    return { key: rawKey, id: stored.id, prefix, label };
  }

  async listKeys(userId: string): Promise<readonly PublicKeyRow[]> {
    const rows = await this.apiKeyRepo.findByUserId(userId);
    return rows.map(({ keyHash: _keyHash, ...rest }) => rest);
  }

  async revokeKey(userId: string, keyId: string): Promise<void> {
    const revoked = await this.apiKeyRepo.revoke(keyId, userId);
    if (!revoked) throw new Error('Key not found');
  }

  async validateKey(rawKey: string): Promise<string | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const stored = await this.apiKeyRepo.findByKeyHash(keyHash);
    if (!stored) return null;

    await this.apiKeyRepo.updateLastUsed(stored.id);
    return stored.userId;
  }
}
