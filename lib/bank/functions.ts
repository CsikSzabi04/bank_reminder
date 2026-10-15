import { isBankErrorCode, type BankErrorCode } from "./types";

// Az Edge Function-ök hívása a felhasználó JWT-jével (a szerver-oldali supabase-kliens csatolja). Nincs titok, nincs PII a logban.
// A kliens szűk alakja azért kell, hogy a hívás fake-kel tesztelhető legyen.
export type FunctionsClient = {
  functions: { invoke: (name: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }> };
};

export type BankCall<T> = { ok: true; data: T } | { ok: false; code: BankErrorCode };

function codeFromStatus(status: number): BankErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "not_allowed";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return status >= 500 ? "upstream_failed" : "unknown";
}

// A hibás (nem 2xx) válasz törzséből csak az ismert `code` értéket vesszük át; minden más a HTTP-státuszból jön
async function codeFromError(error: unknown): Promise<BankErrorCode> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== "object") return "upstream_failed";
  const response = context as { status?: number; json?: () => Promise<unknown> };
  try {
    const body = (await response.json?.()) as { code?: unknown } | undefined;
    if (isBankErrorCode(body?.code)) return body.code;
  } catch {
    /* a törzs nem JSON: a státusz dönt */
  }
  return codeFromStatus(response.status ?? 0);
}

// `pick` a sikeres válasz törzsét ellenőrzi/szűkíti; `null` = nem a várt alak → upstream_failed
export async function callBankFunction<T>(
  client: FunctionsClient,
  name: string,
  body: Record<string, unknown>,
  pick: (data: unknown) => T | null,
): Promise<BankCall<T>> {
  let result: { data: unknown; error: unknown };
  try {
    result = await client.functions.invoke(name, { body });
  } catch {
    console.error("bank function failed", { name, status: 0 });
    return { ok: false, code: "upstream_failed" };
  }
  if (result.error) {
    const code = await codeFromError(result.error);
    console.error("bank function failed", { name, code });
    return { ok: false, code };
  }
  const data = result.data as { ok?: unknown; code?: unknown } | null;
  if (data && data.ok === false) return { ok: false, code: isBankErrorCode(data.code) ? data.code : "unknown" };
  const picked = pick(result.data);
  if (picked === null) {
    console.error("bank function bad shape", { name });
    return { ok: false, code: "upstream_failed" };
  }
  return { ok: true, data: picked };
}
