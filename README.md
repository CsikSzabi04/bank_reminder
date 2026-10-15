# Bank Reminder

Számla- és előfizetés-emlékeztetők, költségkövetés, tippek. Telepíthető PWA (Next.js 16 + React 19 + Tailwind 4 + Supabase).
A „nem bank": fizetést nem indít; alapból csak az általad megadott adatokkal dolgozik, bankszámlához pedig kizárólag olvasási hozzáférést kap, és csak ha te kifejezetten összekötöd (opcionális, lásd lent).

Terv és szabályok: [ARCHITECTURE.md](ARCHITECTURE.md) · állapot: [docs/STATUS.md](docs/STATUS.md) · döntések: [docs/DECISIONS.md](docs/DECISIONS.md) · változások: [CHANGELOG.md](CHANGELOG.md).

## Indítás

```bash
npm install
cp .env.example .env.local   # töltsd ki a publishable key-t (Supabase → Settings → API Keys)
npm run dev                  # http://localhost:3000
```

Csak a `ddvzslgwexvdolovqqlg` Supabase projekt használható (H2). Titok (`sb_secret_…`, DB jelszó, VAPID privát kulcs) soha nem kerül a repóba vagy a kliensbe.

### Környezeti változók (publikusak, a kliensbe kerülhetnek)

| Név | Mire |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase kliens |
| `NEXT_PUBLIC_SITE_URL` | a levelekben és átirányításokban használt cím (záró perjel nélkül) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push előfizetés |
| `NEXT_PUBLIC_FEEDBACK_EMAIL` | (opcionális) a Névjegy „Visszajelzés" `mailto:` címe; nélküle a sor rejtett |

## Szkriptek

| Parancs | Mit csinál |
|---|---|
| `dev` · `build` · `start` | Next |
| `typecheck` | `next typegen` + `tsc --noEmit` |
| `lint` · `i18n:check` | ESLint · HU/EN kulcs-paritás és használt kulcsok |
| `test` | Vitest (`tests/unit`) |
| `test:e2e` · `test:a11y` | Playwright, nyilvános oldalak (360 / 1280 px) · axe-átfutás (`npx playwright install chromium`) |
| `test:e2e:authed` | bejelentkezett e2e a teszt-fiókkal, **csak sorban** (`--workers=1`) |
| `test:e2e:prod` | production build + nonce-os CSP + PWA ellenőrzés |
| `test:all` | az összes kapu egymás után |
| `gen:icons` | PWA-ikonok az `assets/logo.svg`-ből |

Minőségkapuk feladat-lezárás előtt: `typecheck` · `lint` · `i18n:check` · `test` · `build`.

### A bejelentkezett e2e

A teszt-fiók adatai csak a gitignore-os `.env.e2e.local`-ban vannak (`E2E_EMAIL`, `E2E_PASSWORD`); fiók nélkül ezek a tesztek kimaradnak.
Elavult `next dev` a 3000-es porton elavult buildet szolgálhat ki: futtatás előtt állítsd le.

## Szerkezet

| Mappa | Tartalom |
|---|---|
| `app/` | útvonalak (App Router): `(auth)`, `(app)` (védett), `(public)`, `api/` |
| `components/` | UI-komponensek témák szerint (`reminders`, `analytics`, `charts`, `profile`, …) |
| `lib/` | tiszta logika, szerver-akciók, lekérdezések, séma-validáció |
| `locales/` | `hu.json` · `en.json` (minden felhasználói szöveg kétnyelvű, H8) |
| `supabase/` | séma, migrációk, Edge Function-ök (AI-A tulajdona) |
| `tests/` | `unit`, `e2e` (`authed/` a belépett), `a11y` |

## Haladó funkciók (1.1.0): bank-összekötés és keret-riasztás

Terv: [advanced.md](advanced.md). Az app két forrásból tud automatikusan kiadást felvenni: **Enable Banking** (PSD2, olvasási hozzáférés, naponta legfeljebb egyszer; személyes használatra, ezért a `profiles.bank_sync_allowed` kapuval csak az üzemeltetőé) és **Android értesítés-olvasás** (webhook; MacroDroid/Tasker). A bank-hozzáférés lejár — a lejárat-értesítések kötelezőek, nem kapcsolhatók ki —, a keret elfogyásáról pedig azonnal értesít (Profilban kikapcsolható).

- Oldal: **`/bank`** (Összekötés · Android-értesítések · Szabályok); a bank átirányít a `/bank/callback`-re (az Enable-ben pontosan ez az URL van regisztrálva).
- A Next.js alkalmazásban **nincs titok**: az Enable privát kulcsa és App ID-ja csak Edge Function secret (`ENABLE_APP_ID`, `ENABLE_PRIVATE_KEY`, `APP_BASE_URL`); a `*.pem` fájlok `.gitignore`-osak, és a build kliens-csomagját teszt őrzi (`tests/unit/bank-secrets.test.ts`).
- Éles beállítás lépésről lépésre: [docs/DEPLOY-CHECKLIST.md](docs/DEPLOY-CHECKLIST.md) „7. Bank-összekötés".

## Biztonsági alapelvek (kivonat)

RLS minden táblán · nincs secret key az alkalmazásban · nonce-os CSP · összegek `numeric`, összegzés SQL-ben (H9) · nincs kitalált hír vagy tipp (H7) · minden felhasználói szöveg HU és EN (H8).
