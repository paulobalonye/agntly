import { NextResponse } from 'next/server';

/**
 * This endpoint was used by the old custom magic-link flow.
 * Auth is now handled by Supabase — magic links redirect to /auth/callback.
 * Return 410 Gone so any stale clients get a clear error.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, data: null, error: 'This endpoint is no longer active. Auth is handled via /auth/callback.' },
    { status: 410 },
  );
}
