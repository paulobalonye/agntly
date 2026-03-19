import { randomBytes, createHash } from 'node:crypto';
import { generateId } from '@agntly/shared';

interface StoredKey {
  readonly id: string;
  readonly userId: string;
  readonly keyHash: string;
  readonly prefix: string;
  readonly label: string;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

const keys = new Map<string, StoredKey>();
const userKeys = new Map<string, string[]>();

export class ApiKeyService {
  async createKey(userId: string, label: string): Promise<{ key: string; id: string; prefix: string; label: string }> {
    const id = generateId('key');
    const rawKey = `ag_live_sk_${randomBytes(24).toString('hex')}`;
    const prefix = rawKey.slice(0, 14);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const stored: StoredKey = { id, userId, keyHash, prefix, label, lastUsedAt: null, createdAt: new Date(), revokedAt: null };
    keys.set(id, stored);
    const existing = userKeys.get(userId) ?? [];
    userKeys.set(userId, [...existing, id]);

    return { key: rawKey, id, prefix, label };
  }

  async listKeys(userId: string): Promise<readonly Omit<StoredKey, 'keyHash'>[]> {
    const keyIds = userKeys.get(userId) ?? [];
    return keyIds
      .map((id) => keys.get(id))
      .filter((k): k is StoredKey => k !== undefined && k.revokedAt === null)
      .map(({ keyHash, ...rest }) => rest);
  }

  async revokeKey(userId: string, keyId: string): Promise<void> {
    const key = keys.get(keyId);
    if (!key || key.userId !== userId) throw new Error('Key not found');
    keys.set(keyId, { ...key, revokedAt: new Date() });
  }

  async validateKey(rawKey: string): Promise<string | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    for (const [, stored] of keys) {
      if (stored.keyHash === keyHash && stored.revokedAt === null) {
        keys.set(stored.id, { ...stored, lastUsedAt: new Date() });
        return stored.userId;
      }
    }
    return null;
  }
}
