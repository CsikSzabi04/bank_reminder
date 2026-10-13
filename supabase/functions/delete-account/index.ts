// A-17: fiók törlése (GDPR) — JWT-ellenőrzés → avatar-fájlok törlése → auth.users törlése (a kaszkád viszi az összes adatot).
// Visszavonhatatlan; a kliens szöveges megerősítést kér: { confirm: 'DELETE' }.
import { corsHeaders, json, userFromRequest } from '../_shared/auth.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const admin = adminClient();
  const user = await userFromRequest(req, admin);
  if (!user) return json(401, { ok: false, error: 'unauthenticated' });

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== 'DELETE') return json(400, { ok: false, error: 'confirmation_required' });

  // avatar-fájlok (avatars/<uid>/…)
  const { data: files } = await admin.storage.from('avatars').list(user.id, { limit: 100 });
  if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) { console.error('delete_user_failed', error.status); return json(500, { ok: false, error: 'delete_failed' }); }
  return json(200, { ok: true });
});
