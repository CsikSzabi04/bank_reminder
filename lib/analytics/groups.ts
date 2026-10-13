import type { GroupKey } from "@/types/rpc";

// A diagram-szín slot → csoport-kulcs (az SQL `group_key(slot)` tükre: 8 nincs kiosztva, minden ismeretlen → other)
const BY_SLOT: Record<number, GroupKey> = {
  1: "subscriptions",
  2: "housing",
  3: "telecom",
  4: "insurance_tax",
  5: "loans_fees",
  6: "everyday",
  7: "lifestyle",
  9: "other",
};

export function groupKeyForSlot(slot: number): GroupKey {
  return BY_SLOT[slot] ?? "other";
}
