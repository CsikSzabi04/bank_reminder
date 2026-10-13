# Bank Reminder — CLAUDE.md

Ez a projekt **két AI** közös munkája. Minden munkamenet elején:

1. Olvasd el az **[ARCHITECTURE.md](ARCHITECTURE.md)**-t (különösen §2 Kemény szabályok, §7 fájl-tulajdon, §24 feladatlista, §25 protokoll).
2. Olvasd el a `docs/STATUS.md`-t és a `docs/CONTRACT_CHANGES.md`-t (ha már léteznek — az A-01 feladat hozza létre őket).
3. Tudd, melyik szerep vagy: **AI-A (Platform)** = `supabase/**`, scriptek, generált típusok · **AI-B (Experience)** = `app/**`, `components/**`, `lib/**`, `locales/**`, `public/**`, `tests/**`, `utils/supabase/**`, `proxy.ts`. Csak a saját könyvtáraidba írsz.

## Kemény szabályok (kivonat — a teljes: ARCHITECTURE.md §2)

- **H1:** a `D:\CliMark\CliMarkAI-Client-Marketing-AI-main` mappába **tilos írni** (csak olvasható minta; kódot nem másolunk; titkos fájlokhoz — `company.env`, `.env*`, `client_secret*`, `*credentials*`, `keys/`, `twilio*`, `Key*` — nem nyúlsz).
- **H2:** egyetlen Supabase projekt engedélyezett: **`ddvzslgwexvdolovqqlg`**. A ClimarkAI Supabase-ét **soha** nem használod. Supabase-művelet előtt `npm run db:assert` (MCP-connectornál: `get_project_url` ellenőrzés; eltérésnél STOP).
- **H3:** titok (DB jelszó, `sb_secret_…`, VAPID privát, SMTP) **soha** nem kerül fájlba, repóba, logba, chatbe. A Next.js alkalmazásban nincs secret key.
- **H4/H5:** RLS minden táblán; az egyetlen projekt = éles → destruktív DB-művelet csak a gazda jóváhagyásával; séma csak migrációs fájlból.
- **H7:** nincs hamis hír — hír/tipp csak forrással, dátummal, lejárattal.
- **H8:** minden felhasználói szöveg **HU és EN**.
- **H9:** összegek `numeric`, összegzés SQL-ben, nem JS-float.

## Munkarend

- Feladatok sorrendben a §24-ből; kapuk (§22.2): `typecheck` 0 hiba · `lint` · `i18n:check` · `test` · **`build`** (a zöld tsc nem bizonyítja a működő buildet).
- Szerződést (§8, §21) egyoldalúan nem változtatsz → `docs/CONTRACT_CHANGES.md`.
- Commit: `[A] A-06: …` / `[B] B-12: …`; soha `git add .` vakon, nincs `--force`/`--no-verify`.
- Kommentek röviden, magyarul, a *miért*-et írják; azonosítók angolok; LF sorvég.
