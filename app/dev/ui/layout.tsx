import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";

// Fejlesztői játszótér: élesben nem létezik (§14.13)
export default function DevUiLayout({ children }: LayoutProps<"/">) {
  if (process.env.NODE_ENV === "production") notFound();
  return <AppShell>{children}</AppShell>;
}
