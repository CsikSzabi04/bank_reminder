// Gyors-hozzáadás chipek az üres állapotban (§14.6): az űrlap ezekkel előtöltve nyílik.
// A márkanév nem fordítandó; az általános tételek neve a `reminders.quickAdd.<labelKey>` kulcsból jön.
export type QuickAdd =
  | { kind: "brand"; name: string; service: string }
  | { kind: "generic"; labelKey: "electricity" | "gas" | "internet" | "phone" | "rent"; category: string };

export const QUICK_ADD: QuickAdd[] = [
  { kind: "brand", name: "Netflix", service: "netflix" },
  { kind: "brand", name: "Spotify", service: "spotify" },
  { kind: "brand", name: "HBO Max", service: "hbo-max" },
  { kind: "generic", labelKey: "electricity", category: "utilities" },
  { kind: "generic", labelKey: "gas", category: "utilities" },
  { kind: "generic", labelKey: "internet", category: "internet" },
  { kind: "generic", labelKey: "phone", category: "mobile" },
  { kind: "generic", labelKey: "rent", category: "rent" },
];

// `name` az űrlap előtöltött neve (generikusnál a lefordított felirat)
export function quickAddHref(item: QuickAdd, label: string): string {
  const params = new URLSearchParams();
  if (item.kind === "brand") {
    params.set("service", item.service);
  } else {
    params.set("name", label);
    params.set("category", item.category);
  }
  return `/reminders/new?${params.toString()}`;
}
