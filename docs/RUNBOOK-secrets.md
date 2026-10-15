# RUNBOOK — titkok (A-18)

| Titok | Hol él | Beállítás |
|---|---|---|
| `CRON_SECRET` | Supabase **Vault** (`cron_secret`) + Edge secret | `node scripts/setup-secrets.mjs` (azonos értéket ír mindkét helyre; nincs fájlba/konzolra) |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Edge secret | ugyanaz a szkript; a **publikus** kulcsot kiírja → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel + `.env.local`) |
| `VAPID_SUBJECT` | Edge secret | alap `mailto:admin@example.com` (ideiglenes); valós domain után: `--subject https://<domain>` |
| `APP_BASE_URL` | Edge secret | `--app-url https://<domain>` (e-mail-értesítések linkjéhez) |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Edge secret | csak ha az e-mail csatornát használod (Resend-kompatibilis API) — `npx supabase secrets set …` |
| `ENABLE_APP_ID`, `ENABLE_PRIVATE_KEY` | Edge secret | `node scripts/setup-secrets.mjs --enable-key <fájl.pem>` — a `.pem` a **Production** alkalmazás kulcsa (`…<app-id>.pem`, PKCS#8); a script egysoros base64-ként tölti fel, a tartalmát soha nem írja ki. Előbb `--dry-run`-nal ellenőrizhető (DB-jelszó nélkül). **Soha** nem kerül fájlba/repóba/chatbe; a `*.pem` gitignore-os |
| DB jelszó, `sb_secret_…` | a gazda jelszókezelője | **soha** fájlba/repóba/chatbe |

## Első beüzemelés (egyszer)
1. `npx supabase login` (böngészős bejelentkezés — a gazda)
2. `export SUPABASE_DB_PASSWORD='…'` majd `node scripts/setup-secrets.mjs --app-url https://<domain>`
3. `node scripts/db.mjs deploy` (mind az 5 Edge Function)
4. A HTTP-cron migráció (`send_notifications`, `fx_refresh`, `news_ingest`) → `node scripts/db.mjs push --yes`
5. Teszt: az app Profil → Értesítések → „Teszt-értesítés"; `ops_health()`.

## VAPID-csere (ritka)
`node scripts/setup-secrets.mjs --rotate-vapid` → **minden eszköz újra fel kell iratkozzon**; a régi feliratkozások 401/403-mal hibáznak, majd a küldő letiltja őket.

## Enable Banking kulcs (A-47)
- **Feltöltés:** `node scripts/setup-secrets.mjs --enable-key Revolut_<app-id>.pem` (ugyanabban a shellben, ahol a `SUPABASE_DB_PASSWORD` be van állítva), majd `node scripts/db.mjs deploy list-aspsps bank-connect-start bank-connect-finish bank-disconnect`. Az `APP_BASE_URL` secret legyen pontosan az Enable-ben regisztrált redirect URL alapja (**https**, záró `/` nélkül), pl. `https://bankreminder.vercel.app` — a redirect `…/bank/callback`.
- **Ellenőrzés:** a Profil/`/bank` oldalon az „Összekötés" a bankok listáját adja (ha az `ENABLE_*` hiányzik vagy hibás, a függvények `upstream_failed`-et adnak, a naplóban `enable_not_configured`).
- **Kulcscsere:** új `.pem` letöltése az Enable Control Panelből → ugyanaz a parancs az új fájllal; a régi kulcs a Control Panelben törölhető. Az Enable-session-ök a kulcscserétől nem érvénytelenek.
- **Szivárgás esetén:** az Enable Control Panelben új kulcs/alkalmazás, a régi törlése, a feltöltés újra; a `bank_connections` sorok session-jei az új kulccsal is működnek, ha ugyanaz az alkalmazás.
