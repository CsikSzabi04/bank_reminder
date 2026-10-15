# Éles átvétel — ellenőrzőlista a gazdának

A localhoston minden kész és zöld (kapuk: lásd `docs/STATUS.md`). Az élesítés **a gazda jóváhagyásával** történik (B-27); ez a lista a sorrend.
A titkok (`sb_secret_…`, DB jelszó, VAPID privát kulcs, SMTP) **soha** nem kerülnek a repóba, a Vercel *publikus* változói közé vagy a chatbe (H3).

## 1. GitHub

- [ ] Privát repó létrehozása, `main` ág, a helyi commitok feltöltése (`git push`). A `.githooks` secret-scan hook marad.
- [ ] *Settings → Secrets and variables → Actions*:
  - **Variables:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (mindkettő publikus), és **utoljára** `E2E_ENABLED` = `true`.
  - **Secrets:** `E2E_EMAIL`, `E2E_PASSWORD` (a teszt-fiók). Amíg az `E2E_ENABLED` nincs `true`-ra állítva, az „authed" job kimarad, a CI zöld marad.
- [ ] A CI futás zöld: `web` (typecheck · lint · i18n · unit · build), `e2e`, `e2e-prod` (+ `e2e-authed`, ha engedélyezted). *A `web`, `e2e`, `e2e-prod` az első feltöltéskor már zöld volt.*

## 2. Vercel (B-27)

- [ ] Projekt import a repóból · Framework: Next.js · Node 22 · régió: `fra1` (vagy `arn1`).
- [ ] **Environment Variables** (Production **és** Preview külön, ARCHITECTURE.md Függelék A):

  | Név | Érték |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | `https://ddvzslgwexvdolovqqlg.supabase.co` |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a projekt *publishable* kulcsa |
  | `NEXT_PUBLIC_SITE_URL` | a végleges domain (`https://…`, **záró perjel nélkül**) |
  | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | a VAPID **publikus** kulcs |
  | `NEXT_PUBLIC_FEEDBACK_EMAIL` | (opcionális) a Névjegy „Visszajelzés" címe |

  Secret key **nincs** a Next.js alkalmazásban.
- [ ] Domain + HTTPS; a *Preview* deploy-ok jelszóvédettek.
- [ ] A fejlécek (CSP nonce, HSTS, `sw.js` no-store) a kódban vannak; deploy után ellenőrizd: `curl -I https://<domain>/login`.

## 3. Supabase (A-04, a gazda a Dashboardban)

- [ ] *Authentication → URL Configuration:* **Site URL** = a végleges domain (záró perjel nélkül); **Redirect URLs** = `https://<domain>/**` (+ `http://localhost:3000/**` fejlesztéshez).
- [ ] *Providers → Email:* **Confirm email** BE; jelszó min. 8.
- [ ] A 8 e-mail sablon beillesztve (`supabase/email-templates/README.md`); **SMTP**: az alap Supabase SMTP csak a csapattagoknak küld (óránként 2 levél) → éles felhasználókhoz saját SMTP kell.
- [ ] Az Edge Function-ök titkai (VAPID privát, `VAPID_SUBJECT`, `CRON_SECRET`) a `supabase secrets set`-tel — nem fájlban.

## 4. Élesítés utáni füstteszt (≈ 10 perc, valódi e-mail-címmel)

- [ ] Regisztráció → megerősítő levél (személyre szabott, HU/EN) → `/auth/confirm` → onboarding (3 lépés).
- [ ] Első emlékeztető (pl. Netflix) → a Főoldalon megjelenik; „Kifizettem" és Visszavonás.
- [ ] Profil → Értesítések → „Bekapcsolom ezen az eszközön" → **Teszt-értesítés** megérkezik.
- [ ] Naptár-link másolása → az ICS betöltődik a naptár-appba.
- [ ] Jelszó-módosítás; e-mail-módosítás (megerősítő levél az új címre).
- [ ] Adatok letöltése (JSON és CSV megnyílik Excelben, ékezetek rendben).
- [ ] **Fiók törlése** egy *eldobható* fiókkal (az Edge Function `delete-account` valós ellenőrzése) → búcsú-oldal.

## 5. Kézi eszköz-mátrix (ARCHITECTURE.md §22.3)

| Eszköz | Böngésző / mód | Ellenőrizd | Kész |
|---|---|---|---|
| Android | Chrome (böngészőben + telepítve) | Letöltés gomb, push (ütemezett + teszt), „Kifizettem" gomb az értesítésben, app-jelvény | ☐ |
| iPhone (iOS ≥ 16.4) | Safari → Kezdőképernyőre téve | iOS-útmutató, engedélykérés gesztusra, push megérkezik, koppintás → mély link | ☐ |
| iPad | Safari → Kezdőképernyő | mint iPhone, tablet-elrendezés | ☐ |
| Windows | Chrome / Edge (telepítve + böngészőben) | telepítés, push, ablakos app | ☐ |
| Windows | **Brave** | a push-hibaüzenet + „Use Google services for push messaging" út; utána működik | ☐ |
| macOS | Safari + Chrome | „Hozzáadás a Dockhoz", push | ☐ |
| Képernyőolvasó | VoiceOver (iOS), TalkBack (Android) | Főoldal → új emlékeztető → kifizetés → Profil → Értesítések | ☐ |
| Sötét mód / nagy betű / 200% nagyítás | mind | nincs levágott szöveg, kontraszt rendben | ☐ |
| Offline (repülő mód) | telepített app | `offline.html`, nincs fehér képernyő | ☐ |
| Lassú hálózat (3G) | Chrome DevTools | skeleton-ok, nincs elugrás | ☐ |

## 6. Üzemeltetés

- **Visszagörgetés:** frontend — Vercel azonnali rollback; DB — előre-javítás (új migráció). Mentés/helyreállítás: `docs/RESTORE.md`.
- **Hetente:** utolsó cron-futások (`ops_health`), beragadt `sending/failed` sor, hírforrások `last_status = 200`, a Supabase projekt nincs szüneteltetve, `npm audit`.
- **Verzió:** `package.json` (semver) → Profil → Névjegy; változások: `CHANGELOG.md`.
