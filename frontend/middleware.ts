import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware that protects routes by checking for the agntly_token cookie.
 * Runs on the edge — intentionally lightweight, no JWT verification here.
 * The auth-service is the source of truth; we only gate on cookie presence.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('agntly_token')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    const fullPath = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.searchParams.set('redirect', fullPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/marketplace/:path*',
    '/dashboard/:path*',
    '/onboard/:path*',
    '/wallet/:path*',
    '/my-agents/:path*',
    '/my-tasks/:path*',
    '/admin/:path*',
  ],
};
