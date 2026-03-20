import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { DbConnection } from '@agntly/shared';
import { UserRepository } from '../repositories/user-repository.js';

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

export class AuthService {
  private readonly userRepo: UserRepository;

  constructor(db: DbConnection) {
    this.userRepo = new UserRepository(db);
  }

  async register(email: string, password: string): Promise<AuthTokens> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.userRepo.create({ email, passwordHash, role: 'developer' });
    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    return this.generateTokens(user);
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    const user = await this.userRepo.findById(payload.userId);
    if (!user) throw new Error('User not found');

    return this.generateTokens(user);
  }

  async getOrCreateUser(email: string): Promise<{ id: string; email: string; role: string }> {
    const user = await this.userRepo.upsertByEmail(email);
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
