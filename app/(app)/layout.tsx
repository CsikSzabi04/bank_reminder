import { AppShell } from "@/components/shell/app-shell";

// Védett shell. A bejelentkezés-ellenőrzés a proxy.ts-ben lesz (B-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
