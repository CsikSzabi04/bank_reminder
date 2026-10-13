# Bank Reminder

Számla- és előfizetés-emlékeztetők, költségkövetés, tippek. Telepíthető PWA (Next.js 16 + Supabase).
Terv és szabályok: [ARCHITECTURE.md](ARCHITECTURE.md) · állapot: [docs/STATUS.md](docs/STATUS.md).

## Indítás

```bash
npm install
cp .env.example .env.local   # töltsd ki a publishable key-t (Supabase → Settings → API Keys)
npm run dev                  # http://localhost:3000
```

Csak a `ddvzslgwexvdolovqqlg` Supabase projekt használható (H2). Titok (`sb_secret_…`, DB jelszó) soha nem kerül a repóba vagy a kliensbe.

## Szkriptek

| Parancs | Mit csinál |
|---|---|
| `dev` · `build` · `start` | Next |
| `typecheck` | `next typegen` + `tsc --noEmit` |
| `lint` | ESLint |
| `test` | Vitest (`tests/unit`) |
| `test:e2e` · `test:a11y` | Playwright (előtte: `npx playwright install chromium`) |

Minőségkapuk feladat-lezárás előtt: `typecheck` · `lint` · `test` · `build`.
