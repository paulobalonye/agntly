// TODO: SECURITY — Migrate from in-memory Maps to PostgreSQL before production.
// The users, api_keys, and magic_link_tokens tables already exist in migrate.sql.
// In-memory storage means: data lost on restart, no horizontal scaling, rate limits per-instance only.

import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { generateId } from '@agntly/shared';

interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly user: { readonly id: string; readonly email: string; readonly role: string };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: JWT_SECRET env var is required and must be at least 32 characters');
    process.exit(1);
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';

const users = new Map<string, { id: string; email: string; passwordHash: string; role: string; createdAt: Date }>();
const emailIndex = new Map<string, string>();

export class AuthService {
  async register(email: string, password: string): Promise<AuthTokens> {
    if (emailIndex.has(email)) {
      throw new Error('Email already registered');
    }

    const id = generateId('usr');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = { id, email, passwordHash, role: 'developer', createdAt: new Date() };

    users.set(id, user);
    emailIndex.set(email, id);
    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const userId = emailIndex.get(email);
    if (!userId) throw new Error('Invalid credentials');

    const user = users.get(userId);
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    return this.generateTokens(user);
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    const user = users.get(payload.userId);
    if (!user) throw new Error('User not found');

    return this.generateTokens(user);
  }

  getOrCreateUser(email: string): { id: string; email: string; role: string } {
    const existingId = emailIndex.get(email);
    if (existingId) {
      const existing = users.get(existingId);
      if (!existing) throw new Error('User index inconsistency');
      return { id: existing.id, email: existing.email, role: existing.role };
    }

    const id = generateId('usr');
    const user = { id, email, passwordHash: '', role: 'developer', createdAt: new Date() };
    users.set(id, user);
    emailIndex.set(email, id);
    return { id: user.id, email: user.email, role: user.role };
  }

  generateTokens(user: { id: string; email: string; role: string }): AuthTokens {
    const accessOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const refreshOptions: SignOptions = { expiresIn: REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      accessOptions,
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      refreshOptions,
    );

    return { accessToken, refreshToken, expiresIn: 900, user: { id: user.id, email: user.email, role: user.role } };
  }
}
