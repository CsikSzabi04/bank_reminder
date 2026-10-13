import { cookies } from "next/headers";
import { NotificationsSync } from "@/components/notifications/notifications-sync";
import { AppShell } from "@/components/shell/app-shell";
import { ProfileSync } from "@/components/profile/profile-sync";
import { avatarUrl } from "@/lib/avatar";
import { todayIn } from "@/lib/format";
import { getCurrentProfile } from "@/lib/profile/queries";
import { addDays } from "@/lib/tz";
import { createClient } from "@/utils/supabase/server";

// Védett shell. A bejelentkezés-ellenőrzés a proxy.ts-ben van (B-04); itt a felhasználó-chip adatát töltjük.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  const user = profile
    ? { id: profile.id, name: profile.display_name, avatarUrl: avatarUrl(profile.avatar_path) }
    : undefined;

  // harang-számláló + app-jelvény (lejárt és 3 napon belül esedékes, §13.5); a profil nélküli (kijelentkezett) kérésen nincs lekérdezés
  let unread = 0;
  let badge = 0;
  if (profile) {
    const supabase = createClient(await cookies());
    const [u, b] = await Promise.all([
      supabase.rpc("unread_notifications"),
      supabase
        .from("v_occurrences")
        .select("id", { count: "exact", head: true })
        .eq("status", "upcoming")
        .lte("due_date", addDays(todayIn(profile.timezone), 3)),
    ]);
    unread = typeof u.data === "number" ? u.data : 0;
    badge = b.count ?? 0;
  }

  return (
    <AppShell user={user} unread={unread}>
      {profile && <NotificationsSync badge={badge} />}
      {profile && <ProfileSync userId={profile.id} theme={profile.theme} locale={profile.locale} />}
      {children}
    </AppShell>
  );
}
