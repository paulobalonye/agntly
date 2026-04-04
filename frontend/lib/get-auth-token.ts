import { createSupabaseServerClient } from './supabase';

/**
 * Returns the current user's Supabase access token from the server-side
 * session, or null if the user is not authenticated.
 *
 * Use this in API route handlers to get a Bearer token for forwarding to
 * the API gateway.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
