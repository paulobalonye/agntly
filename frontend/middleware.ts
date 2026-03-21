import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware that:
 * 1. Checks license activation (redirects to /activate if not licensed)
 * 2. Protects authenticated routes (redirects to /auth/login if not logged in)
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip license check for the activation page, API routes, and the main agntly.io domains
  const host = request.headers.get('host') ?? '';
  const domain = host.split(':')[0].toLowerCase();
  const isOfficialDomain = domain === 'agntly.io' || domain === 'www.agntly.io' || domain === 'sandbox.agntly.io';
  const skipLicense = pathname === '/activate' || pathname.startsWith('/api/') || isOfficialDomain;

  if (!skipLicense) {
    // Check if license is activated (stored in cookie after first activation)
    const licenseOk = request.cookies.get('agntly_licensed')?.value === '1';

    if (!licenseOk) {
      // Verify with license service
      try {
        const host = request.headers.get('host') ?? 'localhost';
        const licenseUrl = process.env.LICENSE_SERVICE_URL ?? 'http://localhost:3009';
        const domain = host.split(':')[0];

        const res = await fetch(`${licenseUrl}/v1/license/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain }),
          signal: AbortSignal.timeout(3000),
        });

        const data = await res.json();
        if (data?.data?.valid) {
          // Set cookie so we don't re-check every request (expires in 24h)
          const response = NextResponse.next();
          response.cookies.set('agntly_licensed', '1', { maxAge: 86400, path: '/' });
          return response;
        } else {
          return NextResponse.redirect(new URL('/activate', request.url));
        }
      } catch {
        // License service unavailable — allow access (graceful degradation)
        const response = NextResponse.next();
        response.cookies.set('agntly_licensed', '1', { maxAge: 3600, path: '/' });
        return response;
      }
    }
  }

  // Auth-protected routes
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
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
