import { z } from "zod";
import { callBankFunction, type BankCall, type FunctionsClient } from "./functions";
import type { Aspsp } from "./types";

// A bank-műveletek magja: tiszta, injektált klienssel (a Server Action-ök és a callback-route vékony burkolói) → fake-kel tesztelhető.

const asObject = (data: unknown): Record<string, unknown> | null => (data && typeof data === "object" ? (data as Record<string, unknown>) : null);

const startInput = z.object({
  aspspName: z.string().trim().min(1).max(100),
  aspspCountry: z.string().regex(/^[A-Z]{2}$/),
  renewConnectionId: z.uuid().optional(),
});
export type StartInput = z.infer<typeof startInput>;

// Az átirányító URL-nek https-nek kell lennie (a Production csak https-t fogad; `javascript:`/`data:` kizárva)
export function safeAuthUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function startConnectionCore(client: FunctionsClient, input: unknown): Promise<BankCall<{ url: string }>> {
  const parsed = startInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "unknown_bank" };
  const { aspspName, aspspCountry, renewConnectionId } = parsed.data;
  return callBankFunction(
    client,
    "bank-connect-start",
    { aspsp_name: aspspName, aspsp_country: aspspCountry, ...(renewConnectionId ? { renew_connection_id: renewConnectionId } : {}) },
    (data) => {
      const url = safeAuthUrl(asObject(data)?.url);
      return url ? { url } : null;
    },
  );
}

export async function finishConnectionCore(
  client: FunctionsClient,
  input: { code: string; state: string },
): Promise<BankCall<{ connectionId: string | null }>> {
  return callBankFunction(client, "bank-connect-finish", { code: input.code, state: input.state }, (data) => {
    const id = asObject(data)?.connection_id;
    return { connectionId: typeof id === "string" ? id : null };
  });
}

export async function disconnectCore(client: FunctionsClient, connectionId: unknown): Promise<BankCall<{ done: true }>> {
  const id = z.uuid().safeParse(connectionId);
  if (!id.success) return { ok: false, code: "not_found" };
  return callBankFunction(client, "bank-disconnect", { connection_id: id.data }, () => ({ done: true as const }));
}

export async function listAspspsCore(client: FunctionsClient, country = "HU"): Promise<BankCall<Aspsp[]>> {
  return callBankFunction(client, "list-aspsps", { country }, (data) => {
    const list = asObject(data)?.aspsps;
    if (!Array.isArray(list)) return null;
    const out: Aspsp[] = [];
    for (const item of list) {
      const a = asObject(item);
      if (!a || typeof a.name !== "string" || typeof a.country !== "string" || !/^[A-Z]{2}$/.test(a.country)) continue;
      const days = typeof a.max_consent_days === "number" && Number.isFinite(a.max_consent_days) ? Math.floor(a.max_consent_days) : null;
      out.push({ name: a.name.slice(0, 100), country: a.country, maxConsentDays: days });
    }
    return out;
  });
}

// `request_bank_sync` válasza (szerződés-javaslat): { status: queued | too_soon | daily_limit | not_active, next_allowed_at? }
export type RefreshOutcome = { status: "queued" | "too_soon" | "daily_limit" | "not_active"; nextAllowedAt: string | null };

export function parseRefreshOutcome(data: unknown): RefreshOutcome | null {
  const o = asObject(data);
  const status = o?.status;
  if (status !== "queued" && status !== "too_soon" && status !== "daily_limit" && status !== "not_active") return null;
  const next = typeof o?.next_allowed_at === "string" && !Number.isNaN(Date.parse(o.next_allowed_at)) ? o.next_allowed_at : null;
  return { status, nextAllowedAt: next };
}
