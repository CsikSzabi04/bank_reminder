import pkg from "../../../package.json";

// Élet-jel (§21.5): szándékosan nem hív adatbázist, publikus
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, version: pkg.version, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
