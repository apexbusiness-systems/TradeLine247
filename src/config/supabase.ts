/**
 * Supabase Public Configuration
 *
 * These credentials are configured via environment variables:
 * - VITE_SUPABASE_URL: The Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: The public anonymous key (safe for client-side)
 *
 * SECURITY: No fallback values are provided to prevent accidental credential exposure.
 * Configure these in your deployment environment (Vercel, etc).
 */

// SECURITY: Require environment variables - no hardcoded fallbacks
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate configuration at import time
if (!url || !anonKey) {
  console.error(
    '[Supabase Config] Missing required environment variables. ' +
    'Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const SUPABASE_CONFIG = {
  // Public Supabase project URL
  url: url || '',

  // Public anonymous key (safe for client-side use)
  // This key has LIMITED permissions enforced by RLS policies
  anonKey: anonKey || ''
} as const;
