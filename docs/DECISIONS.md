# DECISIONS  (dátum · döntés · alternatívák · indok · ki döntött)

- 2026-10-13 · Dev = az élő Supabase projekt (Q3) · alternatíva: Docker/2. projekt · a gazda döntése; H5 fegyelem érvényes (csak additív migráció, destruktív: jóváhagyással).
- 2026-10-13 · Auth-levelek az alap Supabase SMTP-vel (Q2) · alternatíva: egyéni SMTP · a gazda döntése; korlát: csak szervezeti csapattag-címre küld, 2 levél/óra → idegen felhasználóknak nem megy ki; éles indulás előtt egyéni SMTP kell.
- 2026-10-13 · Next 16.4 scaffold: `cacheComponents` és `partialPrefetching` KI (a create-next-app bekapcsolva adja) · alternatíva: bekapcsolva · a sütis session + RSC/Server Action modell (§6.2, ADR-04) dinamikus; a cacheComponents Suspense-kényszert hozna minden `cookies()`-hívásra · AI-B.
- 2026-10-13 · `typecheck` = `next typegen && tsc --noEmit` (a `LayoutProps`/`PageProps` típusokat a typegen adja; tiszta checkoutban enélkül bukna) · `tsconfig` kizárja `supabase/` és `scripts/` (Deno-kód, AI-A saját ellenőrzése) · AI-B.
- 2026-10-13 · Token-eltérések a §14.2-től (B-06 kontraszt-teszt talált): `--text-muted` világosban #64748B → **#617288** (a surface-2-n 4,47:1 volt) · új token **`--primary-text`** (világos #0A7A6C, sötét = primary) a márka-szövegre halvány háttéren (a `--primary` a `--primary-soft`-on 4,34:1) · a `--primary` (#0B7F70) és a manifest `theme_color` marad · AI-B.
- 2026-10-13 · `react/jsx-no-literals` (error) az `app/**`·`components/**` .tsx-ben (H8-lint); kivétel: `app/dev/**` · írásjelek (`· — / | …`) engedettek · AI-B.
- 2026-10-13 · CI: `.github/workflows/ci.yml` (typecheck · lint · i18n:check · test · build; csak publikus helyőrző env, H3) · e2e/Playwright később külön job · AI-B.
- 2026-10-13 · Toast: saját `ToastProvider` (nincs `sonner`) · alternatíva: sonner (ADR-02) · a sonner futásidőben `<style>`-t injektál, ami a nonce-os CSP-vel (§9.6) ütközik; a saját változat ~100 sor, aria-live, Visszavonás-gomb · AI-B.
- 2026-10-13 · `i18n:check` ICU-elemző: beágyazást kezelő (a plural-ágak puszta szava nem argumentum) · AI-B.
- 2026-10-13 · Kategória-ikonok statikus lucide-térképből (`lib/category-icons.ts`), nem `lucide-react/dynamic` · csak a használt ikonok kerülnek a csomagba · AI-B.
- 2026-10-13 · Migrációk futtatása: Supabase CLI (`npx supabase db push --db-url`), mert nincs Docker/psql/deno a gépen · pgTAP helyett (amíg nincs helyi DB) sima-SQL `do $$ assert … $$` tesztek tranzakcióban, ROLLBACK-kel.
- 2026-10-13 · Analitika: számla a lejárati hónaphoz tartozik (nem a kifizetés hónapjához) · alternatíva: `paid_on` szerint (§15.2 eredeti) · átcsúszó tételek nélkül stabil havi összegek · AI-A (CONTRACT_CHANGES-ben egyeztetve).
- 2026-10-13 · DB-tesztek: sima SQL `do $$ assert … $$` ROLLBACK-kel (`npm run db:test`) pgTAP helyett · nincs Docker a gépen; mutációval ellenőrizve, hogy a tesztek valóban bukni tudnak.
- 2026-10-13 · A-oldali eszközök külön `scripts/package.json`-ban (pg) · az app package.json/lockfile B-é; ütközés elkerülése.
- 2026-10-13 · A-20 push-könyvtár: **`npm:web-push@3.6.7`** · alternatíva: `jsr:@negrel/webpush` (nem auditált) · Deno 2.9-en a törzs független WebCrypto-visszafejtéssel RFC 8291 szerint helyes, a VAPID-JWT (ES256) érvényes (`supabase/functions/_shared/push.test.ts`). Hátralévő kockázat: a Supabase Edge-futtatókörnyezetben a kimenő HTTPS-hívás — az első valódi küldésnél ellenőrizendő (tartalék: @negrel/webpush).
- 2026-10-13 · Edge Function-ök `verify_jwt = false` + saját hitelesítés (cron: x-cron-secret konstans idejű; felhasználói: `auth.getUser(token)`) · az új JWT-aláíró kulcsokkal a gateway-ellenőrzés nem megbízható.
- 2026-10-13 · VAPID_SUBJECT ideiglenesen `mailto:admin@example.com` · a gazda e-mailjét nem küldjük push-szolgáltatóknak; valós domain után `--subject https://<domain>`.
- 2026-10-13 · Pénzformázás a push-szövegekben `useGrouping: 'always'` · hu-HU alapból nem csoportosít 4 jegynél („2300 Ft"); az app formázójával (`lib/format.ts`) egységes: „2 300 Ft".
