import { createSupabaseServerClient } from './supabase';

export interface UserSession {
  userId: string;
  email: string;
  role: string;
}

/**
 * Returns the current authenticated user session from Supabase cookies,
 * or null if the user is not signed in or the session has expired.
 */
export async function getSession(): Promise<UserSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    // Role is stored in user_metadata — synced on sign-up
    const role = (user.user_metadata?.role as string | undefined) ?? 'developer';

    return {
      userId: user.id,
      email: user.email ?? '',
      role,
    };
  } catch {
    return null;
  }
}
