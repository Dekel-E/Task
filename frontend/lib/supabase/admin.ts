import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key. Bypasses RLS — use
// exclusively in route handlers for Storage uploads / signed URLs. NEVER import
// this into a client component (the key must never reach the browser).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
