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
