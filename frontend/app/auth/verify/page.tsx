import { redirect } from 'next/navigation';

/**
 * The old magic-link verify page is no longer used.
 * Supabase redirects to /auth/callback instead.
 * Anyone landing here gets sent back to login cleanly.
 */
export default function VerifyPage() {
  redirect('/auth/login');
}
