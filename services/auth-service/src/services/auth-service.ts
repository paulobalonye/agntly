import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateId } from '@agntly/shared';

interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly user: { readonly id: string; readonly email: string; readonly role: string };
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32';
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

  private generateTokens(user: { id: string; email: string; role: string }): AuthTokens {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken, expiresIn: 900, user: { id: user.id, email: user.email, role: user.role } };
  }
}
