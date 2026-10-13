# RESTORE — mentés, visszaállítás, üzemeltetés (A-26)

> A Supabase **Free** csomagon **nincs automatikus mentés** és az adatbázis **1 hét inaktivitás után szünetel** (ARCHITECTURE.md §6.4, R1, R7).

## 1. Mentés (havonta, vagy nagyobb változtatás előtt)
```bash
# a jelszó CSAK a shellben (soha fájlban):  export SUPABASE_DB_PASSWORD='…'
npx supabase db dump --db-url "postgresql://postgres:$(node -e "console.log(encodeURIComponent(process.env.SUPABASE_DB_PASSWORD))")@db.ddvzslgwexvdolovqqlg.supabase.co:5432/postgres" -f backup-schema.sql
npx supabase db dump --db-url "<ugyanaz>" --data-only -f backup-data.sql
```
A fájlok **személyes adatot** tartalmaznak → a repón kívül tárold (a `.gitignore` nem véd a `backup-*.sql`-től: tedd a repón kívüli mappába). Felhasználónként elérhető az `export_my_data()` RPC is (JSON).

## 2. Visszaállítás
1. Új/üres Supabase projekt (vagy a megsérült törlése) → `node scripts/db.mjs push --yes` a sémához (a migrációk idempotensek-szándékúak, sorrendben futnak).
2. Adat: `psql "<db-url>" -f backup-data.sql` (a séma után). A `auth.users` adat a `--data-only` dumpban **nincs** benne alapból — a felhasználók visszaállításához a Dashboard → Authentication, vagy a `supabase db dump --schema auth --data-only`.
3. Titkok újra: `node scripts/setup-secrets.mjs` (új CRON_SECRET + **új VAPID-pár** → minden eszköznek újra fel kell iratkoznia).
4. `node scripts/db.mjs test` — mind zöld legyen.

## 3. Szünetelő (paused) projekt
Dashboard → a projekt „Restore/Unpause" → 1–2 perc. Közben **nem fut a cron → nem megy értesítés**. A kiesett (24 óránál régebbi) értesítések `expired`-re kerülnek, nem mennek ki utólag (szándékos, §12.2).
Tartós megoldás: Pro csomag, vagy rendszeres aktivitás.

## 4. Napi/heti ellenőrzés (gazda, ~2 perc)
```bash
node scripts/db.mjs sql -e "select jsonb_pretty(public.ops_health())"
```
Nézd: `notifications.due_pending` ≈ 0 · `stuck_sending` = 0 · `cron[].status` = `succeeded` · `news[].last_status` = 200 · `fx_latest` friss (munkanap) · `push.disabled` aránya nem nő hirtelen.

## 5. Jelszó-rotálás (a DB jelszó nyílt chatben szerepelt — éles indulás előtt!)
Dashboard → Project Settings → Database → *Reset database password*. Utána minden helyi shellben új `SUPABASE_DB_PASSWORD`. A Vercel-nek/Next.js-nek **nincs** DB-jelszóra szüksége.
