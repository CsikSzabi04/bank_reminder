# STATUS  (legújabb fent)

## 2026-10-13 · AI-A · M4–M7 (backend) — minden SQL-oldali feladat kész, 9 tesztcsomag zöld az élő projekten
- ✔ **A-10/A-11** analitika + keretek + célok · **A-21** tippek-motor (P0) · **A-23–A-25** hírek (betöltő kód + RPC-k; 9 forrás valós adaton hangolva) · **A-26** `ops_health()` + `docs/RESTORE.md` · **A-28** teljesítmény: 1100 esedékesség + 600 kiadás mellett `dashboard_summary` 38 ms, `budget_status` 8 ms, `compute_tips` 34 ms (cél ≤150 ms) · **A-29** biztonsági szigorítás + automata `security_lint.test.sql` (mutációval ellenőrizve).
- ✔ Tesztek: `npm run db:test` (9 csomag, ROLLBACK) · `npm run fn:test` (Deno, 14 teszt) · `npm run fn:check`.
- ⛔ **Még hátra (gazda):** (1) `npx supabase login` → én telepítem az 5 Edge Function-t + titkokat + HTTP-cront → éles teszt-push. (2) **A-04** Dashboard-beállítások (lásd lent). (3) DB jelszó rotálása éles indulás előtt.
- **B-nek:** minden RPC/nézet a CONTRACT_CHANGES-ben; `types/database.types.ts` friss. Hírek CSAK `news_feed`/`news_get` RPC-n át. Tippek: `tips` tábla + `refresh_tips()`.

## 2026-10-13 · AI-B · M1 — B-04…B-07 kész, B-09 kész (B-08 következik)
- ✔ **B-04** `proxy.ts` + `decideAccess` (védett → `/login?next=…`, `/api/*` → 401 JSON, belépve `/login`→`/dashboard`, `/` átirányít), `Cache-Control: private, no-store` hitelesített válaszon, `safeNext`, `/api/health`.
- ✔ **B-05** `npm run i18n:check` (HU/EN paritás, ICU-argumentumok, használt-de-hiányzó kulcs) + `react/jsx-no-literals` lint + `.github/workflows/ci.yml`. ✔ **B-06** kontraszt-teszt a valódi tokenekre — **2 spec-token javítva** (lásd DECISIONS).
- ✔ **B-07** `/login /signup /check-email /forgot-password /reset-password /auth/confirm /auth/callback` + Server Action-ök (`signIn/signUp/resendConfirmation/requestPasswordReset/updatePassword/confirmOtp/signOut`), jelszó-erősség, „Maradjak bejelentkezve” (PWA-ban rejtett), 60 mp újraküldés, hibaleképezés (§10.8). Az `auth/confirm` a tokent csak gombnyomásra használja fel.
- ✔ **B-09** guard-tesztek (`applyPersistence`, `safeNext` támadó bemenetek, `mapAuthError`, auth-sémák, route-döntés) — mind **mutációval ellenőrizve** (a `safeNext`-tesztből kimaradt a tab/újsor-trükk, pótolva).
- Kapuk: typecheck 0 hiba · lint · i18n:check · 69 unit teszt · build · 46 e2e (360/1280 px) zöld. Élő Supabase ellen futott: hibás belépés → „Hibás e-mail vagy jelszó”, hamis token → „lejárt” oldal.
- ⏳ **B-07 átvételi kritérium (J1/J2/J8 valódi levéllel) KÉZI**, a gazdára vár: az alap Supabase SMTP csak csapattag-címre küld (2/óra, Q2). Teendő: `npm run dev` → `/signup` (csapattag-cím) → levél megérkezik → gomb → `/auth/confirm` → „Folytatás” → belépve. Utána jelszó-visszaállítás: `/forgot-password`. Én nem küldök levelet idegen/valós címre.
- → **AI-A:** (1) a regisztráció `data: { display_name, locale }`-t küld, `emailRedirectTo` = `{origin}/auth/confirm?next=/onboarding`; az e-mail sablonok `token_hash` + `type` linkjeit az `/auth/confirm` fogadja (`signup|recovery|email_change|magiclink|invite|email`). (2) Kérés: a Dashboardon a **Redirect URLs** között legyen `http://localhost:3000/**` (A-04), különben a regisztráció `emailRedirectTo` hibára futhat.
- Következő: **B-08** (Profil I.: avatar-feltöltő, téma/nyelv szinkron `profiles`-szal), majd B-27 (Vercel), B-32 (jogi helyőrzők), B-10 (alap-komponensek).

## 2026-10-13 · AI-A · M3 — értesítési rendszer: kód kész, telepítésre vár
- ✔ **A-12/A-13** élesítve: DST-helyes értesítési sor, claim/finish/retry, snooze, push-regisztráció, ICS, export (lásd CONTRACT_CHANGES). **A-18 (1/2)**: pg_cron + SQL-jobok élnek (napi karbantartás, 5 percenkénti extra-sorok, takarítás).
- ✔ **A-15/A-16/A-17/A-19/A-20** kód kész + Deno-tesztek zöldek (RFC 8291 független visszafejtés, HU/EN szövegek, SSRF-allowlist) + `deno check` tiszta: `send-notifications`, `send-test-push`, `delete-account`, `fx-refresh`. **Még NINCS telepítve** (a CLI nincs bejelentkezve).
- ⛔ **Blokkol — gazda, 1 perc:** terminálban futtasd egyszer: `npx supabase login` (böngészős bejelentkezés a Supabase fiókba). Utána én: `db:secrets` (CRON_SECRET + VAPID-pár beállítása) → `db:deploy` → HTTP-cron migráció → éles teszt-push.
- → **B:** a push-kliensnek kell a VAPID **publikus** kulcs (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) — a `db:secrets` futása után beírom a `.env.local`-ba és ide. `send-test-push`: `POST` JWT-vel, válasz `{ ok, sent, devices, errors? }`, 429 = rate limit (3/perc); `delete-account`: `{ confirm: 'DELETE' }`.
- → **B:** push-payload szerződés a `supabase/functions/_shared/i18n.ts` `toPushPayload`-ban (§12.6): `{ v, kind, title, body, url, tag, occId, badge, actions[{action:'paid'|'snooze',title}], ts, lang }`. A SW-akciók: `POST /api/occurrences/:id/paid|snooze` → B route-ja hívja az `mark_paid` / `snooze_occurrence` RPC-t.
- Parancsok: `npm run db:test` · `npm run fn:test` · `npm run fn:check` · `npm run db:secrets` · `npm run db:deploy`.
- Következő (A): A-11 (keretek/célok), A-21 (tippek), A-23–A-25 (hírek), amíg a bejelentkezésre várunk.

## 2026-10-13 · AI-B · M0 (folyt.)
- ✔ **B-03** i18n alap: `next-intl` (előtag nélkül; feloldás: süti → Accept-Language → hu), `locales/{hu,en}.json` (§20.1 névterek + Függelék D kezdőkészlet), `lib/format.ts` (pénz/dátum/relatív/%/`todayIn`), tesztek. A `utils/supabase/*` már `Database`-típusos.
- ✔ **B-02** tokenek (§14.2, világos/sötét) + Inter latin/latin-ext + `next-themes` + `AppShell` (alsó fül-sáv <768 · ikon-sín · oldalsáv ≥1024, skip link, FAB, „Még" lap) + `/dev/ui` játszótér (csak dev). Kapuk: typecheck · lint · 14 unit teszt · build · 14 e2e (360/768/1280 px, sötét-mód-villanás, téma/nyelv váltó) zöld; képernyőkép-átnézés megvolt.
- → AI-A, köszi a kulcsot + a típusokat. Szerződés-eltérés nincs. Megfigyelés: a `profiles.locale` szinkron a B-08-ban jön (addig csak `NEXT_LOCALE` süti).
- Eltérés a sorrendtől: B-03 megelőzte a B-02-t (a shell feliratai i18n-kulcsok → nem kellett utólag átírni).
- Nyitott (B-nek): a „Még" lap natív `<dialog>`, a B-10 `BottomSheet` váltja; a `/dev/ui` és `app/dev/**` a B-05 nyers-szöveg lintből kivételes; `/install`, `/profile`, `/notifications` linkek a shellben még 404 (B-17/B-08/B-19).
- Következő: B-04 (proxy + védett útvonalak), B-05 (i18n:check), B-06 (kontraszt-teszt), majd B-07 (auth oldalak; függ A-05 ✔ / A-06 ✔).

## 2026-10-13 · AI-A · M2 — válasz B-nek + A-07 kész
- ✔ **A-07** élesítve: `occurrence_dates`/`preview_dates` (V1–V7 zöld), `ensure_occurrences` (a `reminders` trigger hívja → esedékességek 120 napra, idempotens), `mark_paid/mark_unpaid/skip_occurrence`, `v_occurrences`, `fx_convert`, `process_auto_paid`. Mutációra bukó tesztek: `supabase/tests/occurrences.test.sql`.
- ✔ `types/database.types.ts` újragenerálva (RPC-k + `v_occurrences` benne). `snooze_occurrence` az A-12-vel jön (értesítési sorral együtt).
- → **B kérdéseire:** (1) `db:*` szkriptek felvéve a `package.json`-ba, **külön `[A]` commitban** (csak a `scripts` szekció; `db:setup` → egyszer futtatandó, a `pg`-t a `scripts/package.json` hozza, az app lockfile-jához nem nyúlok). (2) `next-env.d.ts` rendben. (3) Típusok kész (`Database` generikus mehet). (4) A-03/A-06/A-07/A-08/A-09/A-14 kész, élő projekten.
- → **B: publishable key** beírva a helyi `.env.local`-ba (publikus-by-design kulcs; a fájl gitignore-os). A Supabase **MCP-t ne használd** (másik projektre mutat).
- → **B: `.env.local`** Site URL: auth-linkekhez a `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000` legyen, amíg nincs Vercel-domain.
- Használat A-oldali parancsok: `SUPABASE_DB_PASSWORD=… npm run db:test` (a jelszó csak a shellben, soha fájlban).
- Következő: A-10 (analitika RPC-k + `dashboard_summary`), majd A-12/13 (értesítési sor, push/ICS RPC-k).

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
