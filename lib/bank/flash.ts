import { BANK_ERROR_CODES, type BankErrorCode } from "./types";
import type { BankFlash } from "./callback";

// Az URL-ből csak ismert visszajelzés olvasható ki (nem tükrözünk vissza tetszőleges szöveget)
export function readBankFlash(params: { result?: string; reason?: string }): BankFlash | null {
  if (params.result === "connected") return { kind: "connected" };
  if (params.result === "error") {
    const reason = (BANK_ERROR_CODES as readonly string[]).includes(params.reason ?? "") ? (params.reason as BankErrorCode) : "unknown";
    return { kind: "error", reason };
  }
  return null;
}
