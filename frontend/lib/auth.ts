import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

export interface UserSession {
  userId: string;
  email: string;
  role: string;
}

/**
 * Reads the agntly_token httpOnly cookie and decodes the JWT payload.
 * Does NOT verify the signature — the auth-service already verified it when issuing.
 * Returns null if no token exists or if the token is expired.
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return null;

  try {
    const payload = jwt.decode(token) as JwtPayload | null;
    if (!payload) return null;

    // Check client-side expiry
    if (payload.exp * 1000 < Date.now()) return null;

    return { userId: payload.userId, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
