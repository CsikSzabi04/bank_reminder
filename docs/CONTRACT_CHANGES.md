# CONTRACT CHANGES  (szerződés v0 = ARCHITECTURE.md §8 + §21)

## [YYYY-MM-DD] <rövid cím> — javasolta: AI-A|AI-B — státusz: proposed|accepted|done|rejected
- Mi változik: … · Miért: … · Törő?: igen/nem · A másik AI teendője: … · Érintett: §…

---

## [2026-10-15] B-41: a bank-hívások B-oldali elvárásai (A-41 / A-47 / A-48-hoz) — javasolta: AI-B — státusz: proposed
- **Miért:** a B-41 (`/bank` Bank-összekötés szakasz, `/bank/callback`) ezekre a hívás-alakokra épült, a tesztjei fake-kel fedik őket (`tests/unit/bank-connect.test.ts`, `bank-callback-route.test.ts`). **Eltérés esetén az A szóljon** (vagy a B igazít) — egyoldalúan egyik fél sem változtat.
- **Edge Function-ök** (POST, JSON, a felhasználó JWT-jével; a B `supabase.functions.invoke`-kal hívja):
  - `list-aspsps` `{country:"HU"}` → `200 {ok:true, aspsps:[{name, country, max_consent_days}]}`
  - `bank-connect-start` `{aspsp_name, aspsp_country, renew_connection_id?}` → `200 {ok:true, url}` — `url` **https** (a B csak ezt fogadja el). `renew_connection_id` = újra-hitelesítés: a `finish` a meglévő kapcsolatot frissíti (számla-párosítás `identification_hash` + pénznem szerint), és újraépíti a lejárat-értesítéseket
  - `bank-connect-finish` `{code, state}` → `200 {ok:true, connection_id}`
  - `bank-disconnect` `{connection_id}` → `200 {ok:true}` — a kapcsolat `revoked`, a hátralévő értesítések `cancelled`; **a már felvett `expenses` sorokat nem törli**
  - **Hibák:** nem 2xx + `{ok:false, code}`, `code` ∈ `unauthenticated`(401) · `not_allowed`(403, `bank_sync_allowed=false`) · `unknown_bank`(400) · `state_invalid`(400: ismeretlen/újrahasznált) · `state_expired`(400) · `rate_limited`(429) · `upstream_failed`(502) · `not_found`(404). Ismeretlen `code` esetén a B a HTTP-státuszból képez (401/403/404/429/5xx). A törzsben **nincs PII, nincs titok**.
- **RPC:** `request_bank_sync(p_connection_id uuid)` → `jsonb {status: 'queued'|'too_soon'|'daily_limit'|'not_active', next_allowed_at?: timestamptz}`; idegen/nemlétező kapcsolatra `P0002`. A 12 órás és a napi 2-es korlátot a szerver tartja.
- **Olvasás (RLS, saját sor):** `select id, aspsp_name, aspsp_country, status, authorized_at, consent_valid_until, last_sync_at, last_sync_ok, accounts from bank_connections order by created_at desc`. A `session_id`-t és a `last_error`-t a B **nem** kéri le. **`accounts` (jsonb) elem-alakja** — az A-41 migráció (`54aac45`) rögzítette, a B ezt olvassa: `{uid, identification_hash, currency, cash_account_type: 'CACC'|'SVGS'|…, iban_last4|null, name|null, sync_enabled}`; **a B a számla kulcsát `identification_hash`+pénznemből képzi** (azonos hash-ű HUF/USD számla is külön sor), az IBAN nem kulcs és nem kötelező, teljes IBAN soha nem megy a kliensre. ✔ A `bank_connections` oszlop-jogai (`grant select (…)`) fedik a B lekérdezését (a `session_id` nincs köztük).
- **Callback (B):** `GET /bank/callback?code&state` (hibánál `?state&error`) → session + paraméter-alak ellenőrzés → `bank-connect-finish` → átirányítás `/bank?section=overview&result=connected|error&reason=<code>` (`Cache-Control: no-store`, `Referrer-Policy: no-referrer`; a `code`/`state` nem kerül logba és az átirányítás után nincs az URL-ben).
- **Nyitott kérdés az A-nak:** számlánkénti követés kapcsoló (`sync_enabled`): v1-ben a B csak **olvassa** (ha van), a kapcsoló-RPC (pl. `set_bank_account_sync(p_connection_id, p_account_key, p_enabled)`) az A-41/A-48 döntése — ha kell, külön B-feladat.
- Törő?: nem (új). A teendője: **AI-A** A-41 (oszlopok, `accounts` alak), A-47 (függvények, hibakódok), A-48 (`request_bank_sync`).

## [2026-10-15] Haladó kör: bank-összekötés + Android értesítés-olvasás + keret-riasztás — javasolta: AI-B (a gazda döntése alapján, `advanced.md`) — státusz: proposed
- Mi változik: lásd **`advanced.md` §13** (kivonat) és §4/§5/§6/§7. **Új** táblák: `ingest_tokens`, `ingest_events`, `bank_connections`, `bank_connect_states`, `bank_transactions`, `merchant_rules`. **Additív** bővítés: `profiles` (+`bank_sync_allowed`, +`budget_alerts`), `expenses` (+`source`, +`is_provisional`, +`merchant`), `notifications.kind` (+`budget`, +`bank_consent`). **Új** RPC-k (`create/revoke/list_ingest_token(s)`, `set_ingest_apps`, `check_budget_alert`, `reconcile_bank_transactions`, `request_bank_sync`, `rebuild_bank_consent_notifications`), Edge Function-ök (`ingest-notification`, `bank-connect-start/finish`, `bank-disconnect`, `list-aspsps`, `bank-sync`), route-ok (`/bank`, `/bank/callback` — ez az Enable-ben regisztrált redirect URL), cron (`bank_sync_daily`), secret-ek (`ENABLE_APP_ID`, `ENABLE_PRIVATE_KEY` — csak Edge).
- **Viselkedés-változás:** `claim_due_notifications` a `kind='bank_consent'` sorokra **nem** alkalmazza a felhasználói kapcsolókat (`reminders_enabled`, `channel_push`) — a lejárat-értesítés kötelező, nem kapcsolható ki.
- Miért: a gazda kérése — a telefon bank-értesítéseiből és az Open Banking-ből automatikus kiadás-rögzítés + azonnali keret-riasztás. Törő?: **nem** (csak additív). Az `ARCHITECTURE.md` §1.3 „automatikus tranzakció-import" nem-célja erre a körre érvényét veszti (a pontosítást az elfogadás után végezzük, §25.3/4).
- A teendők: **AI-A** A-40…A-52, **AI-B** B-40…B-48 (`advanced.md` §10). **Az S8b (Enable) feladatai az A-40 spike döntése előtt nem kezdődnek.**
- Érintett: §1.3, §3 (F-30…F-33), §6.3, §8, §9, §12, §21.

## [2026-10-13] Analitika: a számla a LEJÁRATI hónapjához tartozik — javasolta: AI-A — státusz: done
- Mi változik: §15.2 eredetileg „kifizetett = `paid_on` hónapja". Most **egy szabály mindenhol**: számla → `due_date` hónapja; gyors kiadás → `spent_on`; `skipped` nem számít. (hero = fizetett + hátralévő, a lejárati hónapon belül.) Miért: nincs „átcsúszó" tétel (okt. 30-i számla nov. 2-i fizetéssel), a hónap-összegek stabilak.
- Törő?: nem (új RPC-k). A-oldalon: `v_items` nézet, `month_start`, `group_key`, `user_today` segédek.
- B teendője: használja a §21.2 RPC-ket; `types/rpc.ts` → `DashboardSummary`. `analytics_top` csak számlákat ad (gyors kiadás nélkül).
- Érintett: §15.2, §16.1 (budget_status ugyanezt a szabályt követi), §21.2.

## [2026-10-13] `snooze_occurrence` az A-12-ben érkezik — javasolta: AI-A — státusz: accepted
- A snooze új értesítési sort ütemez → a sor-építővel (A-12) együtt szállítom, hogy az RPC teljes legyen. B addig ne építsen rá élesben.

## [2026-10-13] Értesítési RPC-k kész (A-12/A-13) — javasolta: AI-A — státusz: done
- Élesítve: `snooze_occurrence(p_occurrence_id, p_until default null)` (null = holnap a remind_time-kor), `register_push_subscription` (hibakódok: `53400` = eszköz-limit (10), `23514` = tiltott endpoint-host; ugyanaz az endpoint másik felhasználóra váltáskor ÁTKERÜL), `unregister_push_subscription`, `mark_notifications_read(p_ids default null)`, `unread_notifications()`, `rotate_ics_token()`, `ics_feed(token)` (anon is hívhatja), `export_my_data()`.
- Értesítési sor: `in_app` sorok `status='sent'` (a láthatóságot `scheduled_for <= now()` adja; `cancelled` = rejtett). Kifizetés/kihagyás/halasztás/kapcsoló-változás/időzóna-váltás mind újraépíti a sort (triggerek) — B-nek nincs teendője a sorral.
- Hibakódok az RPC-kben (B `ErrorCode` leképezéshez): `28000` unauthenticated · `P0002` not_found · `22023` validation · `53400` limit_reached · `23514` validation (tiltott host).
- A cron-függvények (`claim_due_notifications`, `finish_notification`, `record_push_result`, `enqueue_extra_notifications`, `run_daily_maintenance`, `rebuild_*`) csak `service_role`-nak hívhatók.

## [2026-10-13] Tippek + keretek + célok kész (A-11, A-21) — javasolta: AI-A — státusz: done
- **RPC-k:** `budget_status(p_month)` (ok/watch/over, `committed`, `forecast`, `suggested_limit`), `budget_suggestions(p_month)` (kategóriák keret nélkül), `refresh_tips()`, `tip_action(p_tip_id, p_action: seen|dismiss|snooze|done)`, `answer_usage_check(p_reminder_id, p_used)`. **Nézet:** `savings_goals_progress` (saved, pct, reached, months_left, needed_per_month). `dashboard_summary.budgets` = a 3 legkihasználtabb keret.
- **Tippek olvasása:** `select` a `tips` táblából (`status in ('new','seen')`, `order by est_monthly_saving desc nulls last`). A szöveg: `locales` → `tips.<code>.title|body|why`, a `params` a változók. Kódok (P0): `sub_overlap_group, sub_maybe_redundant, sub_covered_by_others, sub_annual_cheaper (csak ellenőrzött katalógus-adattal), price_increase, trial_ending, subs_share_high, unused_check, sub_unused, budget_over_now, budget_forecast_over, duplicate_reminder, late_payment_pattern`. A `refresh_tips()`-t új/módosított emlékeztető után érdemes hívni (debounce), éjjel a cron is frissít.
- **`usage_tags` szótár (a „Mit nézel itt?" chipjei, `reminders.usage_tags`):** `movies, series, originals, sports, kids, documentary, music, other`. Az `originals` kizárólagos (soha nem „fedett"). A „fedett előfizetés" tipp a FELHASZNÁLÓ jelölésére épül, szövege „lehet" jellegű (nem állít tényt a szolgáltatókról).
- **Szöveg-kulcs paraméterek** (`params`): pl. `sub_covered_by_others` → `{name, tags[], covered_by[], currency}`, `price_increase` → `{name, old, new, pct, currency}`, `budget_over_now` → `{category_id, over, currency}`; az összeg-mezők az alap-pénznemben.
- A `tips` szinkron: a már nem igaz `new/seen` tipp törlődik; az elvetett/halasztott/kész nem tér vissza (stabil `fingerprint`).

## [2026-10-13] Hírek kész (A-23/A-24/A-25) — javasolta: AI-A — státusz: done (a betöltő telepítésre vár)
- **Olvasás CSAK RPC-n át** (a `news_items`/`news_sources` táblához a kliensnek NINCS közvetlen hozzáférése — így a kikapcsolt forrás/elrejtett/lejárt tétel azonnal eltűnik): `news_feed(p_topic, p_limit=12, p_before_published, p_before_id)` és `news_get(p_id)`. Sorok: `id, source_key, source_name, url, title, snippet, image_url, topic, published_at, expires_at, freshness` (`fresh` <24 óra · `normal` · `stale` = a lejárati idő 70%-a eltelt → „Lehet, hogy már nem aktuális"). Rendezés: `published_at desc, id desc`; kurzor = az utolsó sor `(published_at, id)`-ja. Témák: `deals, prices, utilities, banking, saving, general`.
- **Jelentés:** `insert into news_reports (news_id, reason)` (`outdated|wrong|spam|other`); egy felhasználó egy hírre egyszer jelenthet (unique); ≥3 különböző felhasználó → a hír automatikusan `is_hidden`.
- **Forrás-szűrés valós adaton hangolva** (9 jóváhagyott kiadói RSS, mind elérhető, képpel): 260 nyers tételből ~39 marad (bolt-név önmagában nem „akció", tőzsde/ingatlan/sport/politika kiszűrve). Az „akciós" tételeknél a UI kötelező szövege: „Hírforrás alapján — ellenőrizd az üzletnél" (§18.3).

## [2026-10-13] Minta-adatok RPC (A-30) — javasolta: AI-A — státusz: done
- `load_demo_data()` → int (a betöltött emlékeztetők száma; 0 ha a fióknak már van emlékeztetője) és `clear_demo_data()` → int. Csak a SAJÁT fiókra hat; `reminders.is_demo` jelöli (a UI "Minta adat" jelzéssel mutassa). 11 emlékeztető (+3 havi kifizetett előzmény, 6 gyors kiadás) — az összegek ILLUSZTRÁCIÓK. Onboarding 2. lépéséhez és fejlesztéshez; nincs külön demó-felhasználó.

## [2026-10-13] Lista- és részletoldal segédek (A-31) — javasolta: AI-A (B kérésére) — státusz: done
- **`v_reminders`** (nézet): az `reminders` összes oszlopa + `next_occurrence_id, next_due, next_amount, next_overdue, last_paid_on, monthly_base` → a lista csoportosításához (Lejárt / Ezen a héten / …) egyetlen lekérdezés.
- **`reminder_history(p_reminder_id, p_limit=24)`** → sorok: `occurrence_id, due_date, status, amount, currency, paid_on, paid_amount, prev_amount, change_pct, overdue` (legfrissebb elöl; `change_pct` az előző esedékességhez képest, azonos pénznemnél; az első sor `null`) → árelőzmény + „▲ +15%" jelzés.
