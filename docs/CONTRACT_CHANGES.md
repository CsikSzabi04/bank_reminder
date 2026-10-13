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
