// A Server Action-ök és route-ok közös eredmény-alakja (§21.6).
// A `message` nem kerül közvetlenül a UI-ra: a UI a `code` / `reason` / `fieldErrors` alapján lokalizál.
export type ErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "limit_reached"
  | "upstream_failed"
  | "unknown";

export type ActionState<T = void> =
  | { ok: true; data?: T }
  | {
      ok: false;
      code: ErrorCode;
      // az `auth.error.<reason>` fordítási kulcs utótagja (§10.8)
      reason?: string;
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

export const IDLE: ActionState | null = null;
