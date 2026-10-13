# RUNBOOK — titkok (A-18)

| Titok | Hol él | Beállítás |
|---|---|---|
| `CRON_SECRET` | Supabase **Vault** (`cron_secret`) + Edge secret | `node scripts/setup-secrets.mjs` (azonos értéket ír mindkét helyre; nincs fájlba/konzolra) |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Edge secret | ugyanaz a szkript; a **publikus** kulcsot kiírja → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel + `.env.local`) |
| `VAPID_SUBJECT` | Edge secret | alap `mailto:admin@example.com` (ideiglenes); valós domain után: `--subject https://<domain>` |
| `APP_BASE_URL` | Edge secret | `--app-url https://<domain>` (e-mail-értesítések linkjéhez) |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Edge secret | csak ha az e-mail csatornát használod (Resend-kompatibilis API) — `npx supabase secrets set …` |
| DB jelszó, `sb_secret_…` | a gazda jelszókezelője | **soha** fájlba/repóba/chatbe |

## Első beüzemelés (egyszer)
1. `npx supabase login` (böngészős bejelentkezés — a gazda)
2. `export SUPABASE_DB_PASSWORD='…'` majd `node scripts/setup-secrets.mjs --app-url https://<domain>`
3. `node scripts/db.mjs deploy` (mind az 5 Edge Function)
4. A HTTP-cron migráció (`send_notifications`, `fx_refresh`, `news_ingest`) → `node scripts/db.mjs push --yes`
5. Teszt: az app Profil → Értesítések → „Teszt-értesítés"; `ops_health()`.

## VAPID-csere (ritka)
`node scripts/setup-secrets.mjs --rotate-vapid` → **minden eszköz újra fel kell iratkozzon**; a régi feliratkozások 401/403-mal hibáznak, majd a küldő letiltja őket.
