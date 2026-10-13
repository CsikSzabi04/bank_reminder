import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** service_role kliens (csak szerver-oldalon; a kulcs az Edge-futtatókörnyezetben automatikusan elérhető) */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / service key hiányzik');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
