import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware that protects authenticated routes.
 * Redirects to /auth/login if no agntly_token cookie.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const authProtected = [
    '/marketplace',
    '/dashboard',
    '/onboard',
    '/wallet',
    '/my-agents',
    '/my-tasks',
    '/admin',
  ];

  const needsAuth = authProtected.some((p) => pathname.startsWith(p));
  if (needsAuth) {
    const token = request.cookies.get('agntly_token')?.value;
    if (!token) {
      const loginUrl = new URL('/auth/login', request.url);
      const fullPath = pathname + request.nextUrl.search;
      loginUrl.searchParams.set('redirect', fullPath);
      return NextResponse.redirect(loginUrl);
    }
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
