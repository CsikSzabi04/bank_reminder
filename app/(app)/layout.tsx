import { AppShell } from "@/components/shell/app-shell";
import { ProfileSync } from "@/components/profile/profile-sync";
import { avatarUrl } from "@/lib/avatar";
import { getCurrentProfile } from "@/lib/profile/queries";

// Védett shell. A bejelentkezés-ellenőrzés a proxy.ts-ben van (B-04); itt a felhasználó-chip adatát töltjük.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  const user = profile
    ? { id: profile.id, name: profile.display_name, avatarUrl: avatarUrl(profile.avatar_path) }
    : undefined;

  return (
    <AppShell user={user}>
      {profile && <ProfileSync userId={profile.id} theme={profile.theme} locale={profile.locale} />}
      {children}
    </AppShell>
  );
}
