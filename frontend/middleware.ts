import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const authProtected = [
  '/marketplace',
  '/dashboard',
  '/onboard',
  '/wallet',
  '/my-agents',
  '/my-tasks',
  '/admin',
  '/settings',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Create a mutable response so Supabase can refresh session cookies
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured fall through — don't break non-auth pages
  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      auth: { flowType: 'implicit' },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Refreshes the session and validates the token with Supabase
    const { data: { user } } = await supabase.auth.getUser();

    const needsAuth = authProtected.some((p) => pathname.startsWith(p));
    if (needsAuth && !user) {
      const loginUrl = new URL('/auth/login', request.url);
      const fullPath = pathname + request.nextUrl.search;
      loginUrl.searchParams.set('redirect', fullPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
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
    '/settings/:path*',
  ],
};
