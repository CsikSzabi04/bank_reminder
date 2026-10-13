# DECISIONS  (dátum · döntés · alternatívák · indok · ki döntött)

- 2026-10-13 · Dev = az élő Supabase projekt (Q3) · alternatíva: Docker/2. projekt · a gazda döntése; H5 fegyelem érvényes (csak additív migráció, destruktív: jóváhagyással).
- 2026-10-13 · Auth-levelek az alap Supabase SMTP-vel (Q2) · alternatíva: egyéni SMTP · a gazda döntése; korlát: csak szervezeti csapattag-címre küld, 2 levél/óra → idegen felhasználóknak nem megy ki; éles indulás előtt egyéni SMTP kell.
- 2026-10-13 · Next 16.4 scaffold: `cacheComponents` és `partialPrefetching` KI (a create-next-app bekapcsolva adja) · alternatíva: bekapcsolva · a sütis session + RSC/Server Action modell (§6.2, ADR-04) dinamikus; a cacheComponents Suspense-kényszert hozna minden `cookies()`-hívásra · AI-B.
- 2026-10-13 · `typecheck` = `next typegen && tsc --noEmit` (a `LayoutProps`/`PageProps` típusokat a typegen adja; tiszta checkoutban enélkül bukna) · `tsconfig` kizárja `supabase/` és `scripts/` (Deno-kód, AI-A saját ellenőrzése) · AI-B.
- 2026-10-13 · Migrációk futtatása: Supabase CLI (`npx supabase db push --db-url`), mert nincs Docker/psql/deno a gépen · pgTAP helyett (amíg nincs helyi DB) sima-SQL `do $$ assert … $$` tesztek tranzakcióban, ROLLBACK-kel.
