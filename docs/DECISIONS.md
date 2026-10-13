# DECISIONS  (dátum · döntés · alternatívák · indok · ki döntött)

- 2026-10-13 · Dev = az élő Supabase projekt (Q3) · alternatíva: Docker/2. projekt · a gazda döntése; H5 fegyelem érvényes (csak additív migráció, destruktív: jóváhagyással).
- 2026-10-13 · Auth-levelek az alap Supabase SMTP-vel (Q2) · alternatíva: egyéni SMTP · a gazda döntése; korlát: csak szervezeti csapattag-címre küld, 2 levél/óra → idegen felhasználóknak nem megy ki; éles indulás előtt egyéni SMTP kell.
- 2026-10-13 · Migrációk futtatása: Supabase CLI (`npx supabase db push --db-url`), mert nincs Docker/psql/deno a gépen · pgTAP helyett (amíg nincs helyi DB) sima-SQL `do $$ assert … $$` tesztek tranzakcióban, ROLLBACK-kel.
