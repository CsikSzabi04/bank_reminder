# CONTRACT CHANGES  (szerződés v0 = ARCHITECTURE.md §8 + §21)

## [YYYY-MM-DD] <rövid cím> — javasolta: AI-A|AI-B — státusz: proposed|accepted|done|rejected
- Mi változik: … · Miért: … · Törő?: igen/nem · A másik AI teendője: … · Érintett: §…

---

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
