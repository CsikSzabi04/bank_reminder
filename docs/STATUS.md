# STATUS  (legújabb fent)

## 2026-10-13 · AI-B · M0
- ✔ B-01 scaffold: Next 16.4 + React 19.3 + TS strict + Tailwind 4 + shadcn-alap (`components.json`, `lib/utils.ts`), vitest, playwright (config + smoke), `utils/supabase/{client,server,middleware,env}.ts`, `lib/auth/persist.ts`, `lib/brand.ts`, README. Kapuk: typecheck 0 hiba · lint · test · build · dev (HTTP 200) zöld. (`i18n:check` = B-05; Playwright böngésző még nincs telepítve → e2e nem futott.)
- ⏳ `.env.local` kész az URL-lel; **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` üres** (a Supabase MCP rossz projektre mutat, nem használom) → gazda: Dashboard → Settings → API Keys → publishable key. Auth/DB-hívás addig nem működik.
- → AI-A: (1) a `db:*` szkripteket te veszed fel a `package.json` `scripts`-ébe (§7.3, külön `[A]` commit); a `package.json` már létezik. (2) `.gitignore`-ba felvettem a generált `next-env.d.ts`-t. (3) `utils/supabase/*` még típus nélküli — A-09 (`types/database.types.ts`) után `Database` generikust adok hozzá. (4) Hol tartasz az A-03 / A-06-tal?
- Következő: B-02 (tokenek + shell + `/dev/ui`), B-03 (i18n + formázó).

## 2026-10-13 · AI-A · M1 — B már használhatja az adatbázist
- ✔ **A-06** core séma + RLS + `avatars` bucket **az élő projekten** (migrációk: `supabase/migrations/2026101318*`). Táblák: profiles, categories, service_catalog, reminders, occurrences, expenses, budgets, savings_goals, goal_contributions, push_subscriptions, notifications, fx_rates, tips, news_sources, news_items, news_reports.
- ✔ **A-09** `types/database.types.ts` generálva (a séma változásakor újragenerálom; B ne szerkessze).
- ✔ **A-08** 27 rendszer-kategória (Függ. C) + 18 elemű katalógus (**csak név/kategória/csoport/weboldal; ár és tartalom NINCS**, H7).
- ✔ **A-14** `supabase/tests/rls_isolation.test.sql` zöld, **mutációra bukik** (RLS ki / `using(true)`). Futtatás: tranzakcióban, ROLLBACK-kel (nincs Docker/pgTAP a gépen → sima SQL `assert`).
- ✔ **A-05** e-mail sablonok: `node scripts/build-email-templates.mjs` → `supabase/email-templates/` (8 db + README a tárgyakkal).
- ⏳ **A-04** Auth-beállítások (Dashboard) — a gazdára vár, lásd lent.
- Következő: **A-07** (ismétlődés, esedékességek, mark_paid/skip/snooze RPC-k, `v_occurrences`), majd A-10 (analitika), A-12/13 (értesítési sor).

### B-nek tudnivalók (szerződés v0 változatlan)
- A `profiles` sort a DB trigger hozza létre regisztrációkor; a `signUp` metaadata: `{ display_name, locale }`.
- `profiles.update` oszlop-allowlist: display_name, avatar_path, locale, theme, base_currency, timezone, reminders_enabled, default_offsets, default_notify_time, channel_push, channel_email, notify_hide_details, weekly_digest, tips_enabled, news_enabled, monthly_income, onboarding_done. (`ics_token` csak RPC.)
- `occurrences`, `tips`, `push_subscriptions` (insert/update), `notifications` (kivéve `read_at`) **csak RPC-n át** írhatók (az RPC-k A-07/A-13).
- `categories` (rendszer): `key` kitöltve, `color_slot` 1–7 vagy 9 (8 = piros, kiosztva nincs).
- Dev = élő projekt (Q3): ne futtass destruktív SQL-t; teszt-felhasználót takarítsd.

## 2026-10-13 · AI-A · M0
- ✔ A-01 (git, .gitignore, secret-scan hook `.githooks`), ✔ A-02 `scripts/assert-project.mjs`, ✔ A-03 `supabase/config.toml` + migrációk CLI-vel (`npx supabase db push --db-url`).
- ⚠ A Supabase **MCP-connector a `smvccngpqzxedttdamia` projektre mutat** (NEM a miénk) → H2 miatt **nem használjuk**; csak közvetlen DB-kapcsolat/CLI.
- Gazdai döntések: Q1 nincs → „Bank Reminder"/teal · Q2 alap Supabase SMTP · Q3 az élő projekt a dev is · Q6 hírforrás-lista jóváhagyva.
- npm-szkriptek (`db:*`) a `package.json`-ba kerülnek, ha B-01 létrehozta; addig `node scripts/...`.

## Kérdések a gazdának
- **A-04 (Dashboard, ~10 perc):** Authentication → Providers → Email: *Confirm email* **BE**; *Minimum password length* **8**; URL Configuration: *Site URL* (jelenleg `http://localhost:3000`, a Vercel-domain után cserélni; **záró perjel nélkül**) + Redirect URLs (`http://localhost:3000/**`); Email Templates: a `supabase/email-templates/README.md` táblázata szerint 8 sablon beillesztése. *(Gyorsítás: ha adsz egy Supabase **personal access token**-t (`sbp_…`), ezt én be tudom állítani API-n — de a token titok, csak ha kényelmes.)*
- **Q2 korlát (tudomány):** az alap Supabase SMTP **csak a szervezet csapattagjainak** küld, óránként 2 levelet → idegen felhasználóknak a megerősítő levél nem megy ki; teszthez a saját (csapattag) címed jó.

## Kézi ellenőrzések (§22.3)
☐ Android ☐ iPhone ☐ Windows/Chrome ☐ Brave ☐ macOS Safari ☐ Offline
