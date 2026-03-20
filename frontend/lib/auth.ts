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
 * Reads the agntly_token httpOnly cookie and verifies the JWT signature.
 * Returns null if no token exists, if the signature is invalid, or if the token is expired.
 */
export async function getSession(): Promise<UserSession | null> {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { userId: payload.userId, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
