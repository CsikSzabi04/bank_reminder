"use client";

import { useRouter } from "next/navigation";
import { RowMenu } from "./row-menu";

// A részletoldal "⋯" menüje: törlés után a listára visz (a RowMenu közös a listával)
export function DetailMenu(props: {
  reminderId: string;
  occurrenceId: string | null;
  name: string;
  active: boolean;
}) {
  const router = useRouter();
  return <RowMenu {...props} afterDelete={() => router.push("/reminders")} />;
}
