// A NEXT_PUBLIC_* változókat literál property-hozzáféréssel kell olvasni, különben a Next nem inlineolja őket
export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Hiányzó NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)",
    );
  }
  return { url, key };
}
