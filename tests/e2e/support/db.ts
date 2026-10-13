import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.types";

export const hasE2eAccount = () => Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

// A teszt-fiók nevében hívott Supabase-kliens (a publikus kulccsal + a fiók jelszavával; RLS érvényes).
// Az ellenőrzésekhez és a takarításhoz kell: nem a UI-t kerüli meg, hanem az eredményét olvassa vissza.
export async function userClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("hiányzó NEXT_PUBLIC_SUPABASE_* (.env.local)");
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password: process.env.E2E_PASSWORD!,
  });
  if (error || !data.user) throw new Error("a teszt-fiók belépése sikertelen");
  return { client, userId: data.user.id };
}

type UserClient = Awaited<ReturnType<typeof userClient>>["client"];

// A teszt-fiók emlékeztetőinek teljes takarítása (a fiók kizárólag e2e-re van; az RLS csak a sajátját engedi törölni).
// Az esedékességek és az értesítések kaszkáddal törlődnek.
export async function purgeReminders(client: UserClient) {
  await client.rpc("clear_demo_data");
  const { error } = await client.from("reminders").delete().not("id", "is", null);
  if (error) throw new Error("a teszt-emlékeztetők takarítása sikertelen");
}

// A teszt-fiók ismert alaphelyzetbe állítása: egy megszakadt korábbi futás se hagyhasson maga után
// angol nyelvet, profilképet vagy emlékeztetőket, amik a magyar felületet váró teszteket elrontanák.
export async function resetAccount() {
  const { client, userId } = await userClient();
  await purgeReminders(client);
  const { error } = await client.from("profiles").update({ locale: "hu", theme: "system", avatar_path: null }).eq("id", userId);
  if (error) throw new Error("a teszt-profil alaphelyzetbe állítása sikertelen");
  const { data: files } = await client.storage.from("avatars").list(userId);
  if (files?.length) await client.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
}
