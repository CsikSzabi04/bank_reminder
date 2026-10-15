// Hideg `next dev` esetén (CI) az első kérés lefordítja az útvonalat, és a lassú hidratálás alatt az űrlap-tesztek
// natív submitot váltanak ki. A tesztek előtt végigkérjük a nyilvános útvonalakat, hogy lefordítva legyenek.
const ROUTES = ["/login", "/signup", "/forgot-password", "/check-email", "/reset-password", "/privacy", "/terms", "/install", "/goodbye", "/dev/ui", "/api/health"];

export default async function globalSetup() {
  if (!process.env.CI) return;
  const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  for (const route of ROUTES) {
    try {
      await fetch(`${base}${route}`, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    } catch {
      /* a melegítés csak segítség: a tesztek maguk jelzik, ha egy oldal nem él */
    }
  }
}
