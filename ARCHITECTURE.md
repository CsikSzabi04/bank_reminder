# Bank Reminder — ARCHITECTURE.md

> **Munkacím:** *Bank Reminder* (a végleges név/domain még nyitott kérdés → §26). A név egyetlen helyen él: `lib/brand.ts` (`APP_NAME`).
> **Verzió:** v0.1 — 2026-10-13 · **Státusz:** tervezési dokumentum, kódolás még nem kezdődött
> **Nyelv:** a dokumentum magyar; a kód-azonosítók angolok; a felhasználói szövegek **mind** HU + EN (§20)
> **Célközönség:** két AI kódoló ágens (**AI-A: Platform**, **AI-B: Experience**) + a projekt gazdája (Szabi)

---

## Tartalom

0. [Hogyan használd ezt a dokumentumot](#0-hogyan-használd-ezt-a-dokumentumot)
1. [Vízió, alapelvek, nem-célok](#1-vízió-alapelvek-nem-célok)
2. [KEMÉNY SZABÁLYOK (tiltások, védőkorlátok)](#2-kemény-szabályok-tiltások-védőkorlátok)
3. [Funkciólista és prioritások](#3-funkciólista-és-prioritások)
4. [Felhasználói folyamatok](#4-felhasználói-folyamatok)
5. [Technológiai döntések (ADR)](#5-technológiai-döntések-adr)
6. [Rendszerarchitektúra](#6-rendszerarchitektúra)
7. [Repo-struktúra és fájl-tulajdon](#7-repo-struktúra-és-fájl-tulajdon)
8. [Adatmodell (Postgres)](#8-adatmodell-postgres)
9. [Biztonság, RLS, adatvédelem](#9-biztonság-rls-adatvédelem)
10. [Auth és session](#10-auth-és-session)
11. [E-mail sablonok (Supabase Auth)](#11-e-mail-sablonok-supabase-auth)
12. [Értesítési rendszer](#12-értesítési-rendszer)
13. [PWA és a „Download" gomb](#13-pwa-és-a-download-gomb)
14. [UI/UX specifikáció](#14-uiux-specifikáció)
15. [Analytics és diagramok](#15-analytics-és-diagramok)
16. [Költségkeretek és megtakarítási célok](#16-költségkeretek-és-megtakarítási-célok)
17. [Tippek-motor](#17-tippek-motor)
18. [Hírek és akciók](#18-hírek-és-akciók)
19. [Profil és beállítások](#19-profil-és-beállítások)
20. [i18n, téma, formázás](#20-i18n-téma-formázás)
21. [Szerződés A↔B (RPC-k, Server Actions, route-ok)](#21-szerződés-ab-rpc-k-server-actions-route-ok)
22. [Tesztelés és minőségkapuk](#22-tesztelés-és-minőségkapuk)
23. [Deploy, környezetek, üzemeltetés](#23-deploy-környezetek-üzemeltetés)
24. [Mérföldkövek és feladatlista](#24-mérföldkövek-és-feladatlista)
25. [Együttműködési protokoll a két AI között](#25-együttműködési-protokoll-a-két-ai-között)
26. [Kockázatok és nyitott kérdések](#26-kockázatok-és-nyitott-kérdések)
- [Függelék A — Környezeti változók](#függelék-a--környezeti-változók)
- [Függelék B — Referencia-képek leképezése](#függelék-b--referencia-képek-leképezése)
- [Függelék C — Kategóriák és színslotok](#függelék-c--kategóriák-és-színslotok)
- [Függelék D — Microcopy kulcsok (kezdőkészlet)](#függelék-d--microcopy-kulcsok-kezdőkészlet)
- [Függelék E — Indító promptok a két AI-nak](#függelék-e--indító-promptok-a-két-ai-nak)

---

## 0. Hogyan használd ezt a dokumentumot

**Ha AI-A vagy AI-B vagy:**

1. Olvasd el a **§2 Kemény szabályokat** — ezek minden más fölött állnak.
2. Olvasd el az **§1, §5, §6, §7** fejezetet (kb. 10 perc) — ebből tudod, mi épül, mivel, és mi a *tiéd*.
3. Menj a **§24**-hez: ott van a te feladatsorod (`A-xx` vagy `B-xx` azonosítókkal), elfogadási kritériumokkal.
4. A két oldal közti **szerződés** a **§8 (adatmodell)** és a **§21 (RPC/Server Action/route lista)**. Ezt nem írod át egyoldalúan — változtatáshoz §25 szabálya szerint jelezz.
5. Minden munkamenet elején olvasd el: `docs/STATUS.md` és `docs/CONTRACT_CHANGES.md` (ezeket az első feladat hozza létre, §25).
6. Minden munkamenet végén írj egy rövid sort a `docs/STATUS.md`-be (mi kész, mi blokkol, mit vársz a másiktól).

**A dokumentum jelölései**

| Jelölés | Jelentés |
|---|---|
| **MUST** / **TILOS** | Nem alkudható. Ha nem tudod betartani, állj meg és kérdezz. |
| **SHOULD** | Alapértelmezés; indokolt esetben eltérhetsz, de írd le a `docs/DECISIONS.md`-be. |
| ⭐ | „Extra" funkció — a gazda nem kérte név szerint, de érdemes (§3). |
| `P0 / P1 / P2` | Prioritás: P0 = MVP (kötelező az első kiadáshoz), P1 = első bővítés, P2 = később. |
| `[A]` / `[B]` / `[AB]` | Ki a felelős: AI-A, AI-B, vagy mindkettő. |
| 🔴 | Gyakori hibaforrás / biztonsági kritikus pont. |

**Referencia-képek:** a `docs/reference/` mappában (4 db) — a kinézet kiindulópontja. Leképezésük: **Függelék B**.

---

## 1. Vízió, alapelvek, nem-célok

### 1.1 Egy mondatban

> Egy **egyszerű, de nagyszerű** webalkalmazás (telepíthető PWA), ahol a felhasználó felvesz **bank-/számla-/előfizetés emlékeztetőket** (pl. *Netflix — 2 300 Ft — havonta 10-én — 1 nappal előtte értesítsen*), és az app **minden eszközén** (telefon, tablet, laptop, PC) értesítést küld; közben szép **analitikát**, **költségkeret-követést**, **spórolási tippeket** és **friss, megbízható híreket/akciókat** mutat.

### 1.2 Alapelvek

1. **Egyszerű, de nagyszerű.** Egy új felhasználó 60 másodpercen belül felvesz egy emlékeztetőt és bekapcsolja az értesítést. Nincs beállítás-dzsungel; az alapértelmezések okosak (értesítés 1 nappal előtte, 09:00-kor).
2. **Az app nem kezel pénzt, és nem fér hozzá bankszámlához.** Csak *emlékeztet* és *számol*. Nincs banki bejelentkezés, nincs open-banking v1-ben. Ezt a UI-ban is ki kell mondani (§9.5).
3. **Mobile-first, de asztalon is gyönyörű.** Telefonon alsó fül-sáv + FAB; asztalon oldalsáv + két oszlopos dashboard (lásd Függelék B, ref-3).
4. **Fehér, tiszta, levegős felület** (világos mód az alap), kerek kártyák, vékony vonalak, kevés szín. Sötét mód külön megtervezett (nem „invertált").
5. **Az adat a felhasználóé.** RLS minden táblán, exportálható, törölhető (GDPR, §9).
6. **Nincs hamis hír.** A híreknél/akcióknál minden tételnek van forrása, dátuma és lejárata; generált „tények" nincsenek (§18).
7. **Két nyelv első osztályú:** magyar (alap) és angol. Minden string, e-mail, push-szöveg kétnyelvű.
8. **Párhuzamosan építhető.** A két AI csak a §8/§21 szerződésen keresztül találkozik; külön mappákban dolgozik (§7).

### 1.3 Nem-célok (v1)

- Bankkártya/bankszámla összekötés, automatikus tranzakció-import (csak CSV-import P2-ben).
- Fizetés lebonyolítása, átutalás indítása.
- Több tagos szervezet/céges könyvelés.
- Natív iOS/Android store app (a PWA a „letöltés"; Capacitor/TWA csak P2, ha a PWA-push korlátai zavarnak — §13.6).
- Mesterséges intelligenciával generált tartalom a tippekben/hírekben (determinisztikus szabályok, §17–18).

---

## 2. KEMÉNY SZABÁLYOK (tiltások, védőkorlátok)

> Ezek a gazda kifejezett utasításai és biztonsági minimumok. **Mindkét AI-ra érvényesek.** Ha egy feladat ütközik velük, a feladatot kell módosítani, nem a szabályt.

### H1 — A ClimarkAI mappa **csak olvasható** 🔴

- Mappa: `D:\CliMark\CliMarkAI-Client-Marketing-AI-main`
- **TILOS** bármit írni, szerkeszteni, törölni, átnevezni benne; **TILOS** ott `npm`/`node`/`git`/szkriptet futtatni; **TILOS** a `node_modules`, `.next`, `.tunnel`, `.tmpz` stb. bármilyen módosítása.
- **TILOS** megnyitni/idézni a titkos fájlokat: `company.env`, bármilyen `.env*`, `client_secret*.json`, `climarkai-ses-smtp_credentials.csv`, `twilio_2FA_recovery_code.txt`, `Key*.pk/.pub`, a `keys/` mappát, `tunnel.log`.
- Olvasni **szabad** (minta/ötlet céljából): UI-minták, `public/sw.js`, `site.webmanifest`, `locales/`, `tailwind`/`globals.css` tokenek stb.
- 🔴 **Kód nem másolható szó szerint** (a mappában `LICENSE`, `NOTICE` és fejlesztői szerződés van → a tulajdonjogi helyzet nem tisztázott). **Ötleteket, mintákat átveszünk, a kódot újraírjuk.**
- Ami onnan átvett *tanulság* (a felmérés alapján, 2026-10-13): lásd §5.3.

### H2 — Csak a Bank_Reminder Supabase projekt 🔴

- Egyetlen engedélyezett projekt: **`ddvzslgwexvdolovqqlg`** (`https://ddvzslgwexvdolovqqlg.supabase.co`, Supabase szervezet: `bank_reminder`, régió: eu-north-1 Stockholm, **Free** csomag).
- **TILOS** a ClimarkAI Supabase-ét/adatbázisát/kulcsait használni — semmilyen formában (még olvasni sem a futó projektjét).
- **Védelem:** minden Supabase-hez nyúló műveletet (CLI `link`, `db push`, `functions deploy`, MCP-connector hívás, SQL futtatás) **megelőz egy ellenőrzés**:
  - CLI/script: `node scripts/assert-project.mjs` — hibával leáll, ha a `NEXT_PUBLIC_SUPABASE_URL` / `supabase/.temp/project-ref` nem `ddvzslgwexvdolovqqlg` (**A-02**).
  - MCP-connector (ha van Supabase-connector a munkamenetben): először `get_project_url`; ha az URL nem a fenti, **STOP**, ne futtass SQL-t. Az MCP-connector bármelyik fiókhoz/projekthez kötve lehet — ne feltételezd, hogy a jóhoz.

### H3 — Titkok kezelése 🔴

| Érték | Hol élhet | Hol TILOS |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel env, kliens-kód | — (publikus-by-design) |
| `SUPABASE_SECRET_KEY` (`sb_secret_…`) | **csak** Edge Function secret-ek / szerver-oldali env | repo, kliens-bundle, dokumentum, log, chat |
| DB jelszó | a gazda jelszókezelője; CLI-hez `SUPABASE_DB_PASSWORD` env, csak helyben | repo, dokumentum, log |
| VAPID privát kulcs, SMTP/API jelszavak, `CRON_SECRET` | Edge Function secret / Vault | repo, kliens |

- A repo-ban **csak** `.env.example` lehet (értékek nélkül). `.env*` a `.gitignore`-ban — **első commit előtt** (A-01/B-01).
- **A DB jelszót a gazda 2026-10-13-án nyílt chatben megosztotta → kompromittáltnak kell tekinteni.** Éles indulás előtt **rotálni kell** (Supabase Dashboard → Database → Settings). Ezt a §26 is tartalmazza. A jelszót ez a dokumentum szándékosan nem tartalmazza.
- Titkot tartalmazó fájlt **soha** ne olvass ki úgy, hogy a tartalmát kiírod. Ha véletlenül titkot látsz kimenetben: ne ismételd meg, jelezd a gazdának.

### H4 — RLS mindenhol

- A `public` séma **minden** táblájára `enable row level security` + explicit policy. RLS nélküli tábla nem mehet be migrációba (CI-ellenőrzés: **A-14**).
- `security definer` függvény: `set search_path = ''`, teljesen minősített nevek, `revoke execute … from public, anon` (§9.3).

### H5 — Egyetlen projekt = élő rendszer

- A Supabase **Free** csomagon nincs branching és nincs napi backup. A `main` „PRODUCTION"-nek van jelölve. Ezért:
  - Migráció csak **fájlból** (`supabase/migrations/*.sql`), előre átnézve; **TILOS** a dashboardon kézzel sémát módosítani (kivéve Auth-beállítások, §10.5).
  - Destruktív művelet (`drop`, `truncate`, adat-törlő `update/delete`) **csak a gazda jóváhagyásával**, előtte exporttal (`pg_dump` vagy `export_my_data` szkript).
  - **SHOULD:** fejlesztéshez helyi Supabase (Docker: `supabase start`) vagy egy második ingyenes projekt (`bank_reminder_dev`). A gazda dönt (§26-Q3).

### H6 — Tulajdon-határok

- Csak a saját könyvtáraidba írsz (§7.2). Idegen könyvtárat csak olvasol. Közös fájlokhoz (§7.3) a §25 szabályai szerint nyúlsz.

### H7 — Hamis hír tilos

- Tippekben/hírekben **nem szerepelhet** olyan állítás, aminek nincs forrása + dátuma + lejárata. Generatív „kitalált akció" nincs. Részletek: §18.3.

### H8 — Kétnyelvűség

- Minden felhasználói szöveg (UI, hibaüzenet, e-mail, push, tipp) **HU és EN**. Hiányzó fordítás = hibás build (lint-szabály, **B-05**).

### H9 — Pénz = nem float

- Összegek: Postgres `numeric(14,2)`. Összegzés/átváltás **SQL-ben** (RPC), a kliens csak formáz (`Intl.NumberFormat`). JS-ben `0.1+0.2` jellegű float-számolás összegekre tilos.

### H10 — Nem pénzügyi tanácsadás

- A tippek *ötletek, becslések*. Minden tipp-kártyán és a „Tippek" oldal alján disclaimer (HU/EN, §17.5). Az app nem kér banki hitelesítő adatot.

### H11 — Kód- és munkastílus (a gazda másik projektjéből átvett konvenciók)

- TypeScript `strict`, `npm run typecheck` **nulla hiba**; „zöld tsc + zöld teszt" **nem** bizonyítja, hogy a build működik → mérföldkő-zárás előtt `npm run build` is (§22).
- LF sorvégek (`.gitattributes`: `* text=auto eol=lf`).
- Kommentek **röviden, magyarul**, csak a *miértet* írják le (nem a mit). Azonosítók angolok.
- Védett fetch: `credentials: 'include'`; az identitás **csak** szerver-oldalon, a Supabase JWT-ből jön (`getClaims()`/`getUser()`), soha kliens által írható headerből/body-ból.
- Feltöltés-validáció szerveren: allowlist + **magic byte** ellenőrzés, nem fájlnév/MIME alapján.
- Lekérdezésnél csak a ténylegesen olvasott oszlopokat `select`-eld.
- Minden tartós szabályhoz *guard-teszt* (vitest/pgTAP), amit mutációval ellenőrzöl.

---

## 3. Funkciólista és prioritások

### 3.1 Teljes lista

| ID | Funkció | Pri | Ki | Megjegyzés |
|---|---|---|---|---|
| F-01 | **Regisztráció** e-mail+jelszóval, **e-mail megerősítés** (személyre szabott levél) | P0 | AB | §10, §11 |
| F-02 | **Belépés**, **„Maradjak bejelentkezve"**, **elfelejtett jelszó / jelszó-reset**, kilépés | P0 | AB | §10 |
| F-03 | **Profil**: név, **profilkép**, nyelv (HU/EN), téma (világos/sötét/rendszer), emlékeztetők globális be/ki, alapértelmezések, fiók törlés, adat-export | P0 | AB | §19 |
| F-04 | **Emlékeztető-kezelés (CRUD)**: név, összeg, pénznem, kategória, ismétlődés (egyszeri/heti/havi/negyedéves/éves/egyéni), esedékesség napja, **hány nappal előtte** értesítsen, értesítés **be/ki** emlékeztetőnként | P0 | AB | §8, §14 |
| F-05 | **Esedékességek**: „Kifizettem", kihagyás, halasztás (snooze), visszavonás; lejárt jelzés | P0 | AB | §8.4 |
| F-06 | **Dashboard**: hó összege + fánk-diagram, következő esedékesek, előfizetések (ref-1, ref-3) | P0 | B (+A RPC) | §14.5 |
| F-07 | **Értesítések mindenhol**: Web Push (telefon/tablet/laptop/PC), in-app értesítésközpont, opcionális e-mail | P0 | AB | §12 |
| F-08 | **PWA + „Download" gomb**: telepíthető telefonra/tabletre/laptopra/PC-re; offline shell | P0 | B | §13 |
| F-09 | **Analytics**: havi kiadás, kategóriák, trend, kumulatív, top tételek, előfizetés-költség | P0 | AB | §15 |
| F-10 | **Világos/sötét téma + HU/EN váltás** | P0 | B | §20 |
| F-11 | **Spending & Budgets**: kategória-keretek, folyamatjelző sávok, túllépés pirossal (ref-4) | P1 | AB | §16 |
| F-12 | ⭐ **Gyors kiadás-rögzítés** (kávé, bevásárlás…) a keretekhez | P1 | AB | §16.3 |
| F-13 | **Megtakarítási célok** (ref-2) | P1 | AB | §16.4 |
| F-14 | **Tippek-motor**: átfedő előfizetések, árváltozás, éves csomag stb. | P1 | AB | §17 |
| F-15 | **Hírek és akciók**: külön oldal, képekkel, forrással, frissesség-védelemmel | P1 | AB | §18 |
| F-16 | ⭐ **Naptár nézet** + **ICS/webcal feed** (Google/Apple/Outlook naptárba) | P1 | AB | §14.9, §12.8 |
| F-17 | ⭐ **Heti összefoglaló** (digest): „következő 7 nap: 3 tétel, 14 200 Ft" | P1 | A (+B beállítás) | §12.7 |
| F-18 | ⭐ **Árfolyam-átváltás** (USD/EUR előfizetések HUF-ban) | P1 | A (+B) | §8.7 |
| F-19 | ⭐ **Próbaidő-lejárat emlékeztető** („az ingyenes próba holnap lejár") | P1 | AB | §8.4 |
| F-20 | ⭐ **Árváltozás-észlelés + árelőzmény** („Netflix +300 Ft/hó") | P1 | AB | §17 |
| F-21 | ⭐ **Szolgáltatás-katalógus** gyorsfelvételhez (Netflix, HBO Max, Spotify, Telekom…) | P0/P1 | AB | §8.5 |
| F-22 | ⭐ **Műveletek az értesítésből**: „Kifizettem" / „Holnap emlékeztess" gomb a push-on | P1 | AB | §12.5 |
| F-23 | ⭐ **App-ikon jelvény** (nyitott esedékesek száma, Badging API) | P1 | B | §13.5 |
| F-24 | ⭐ **Onboarding** (3 lépés: nyelv/téma → első emlékeztető → értesítés) | P0/P1 | B | §14.11 |
| F-25 | ⭐ **Adat-export (JSON/CSV) + fiók törlés** | P0 | AB | §9.4 |
| F-26 | Háztartás-megosztás (partner meghívása, közös emlékeztetők) | P2 | AB | — |
| F-27 | CSV-import banki kivonatból → ismétlődő tételek felismerése | P2 | AB | — |
| F-28 | Havi „Wrapped" riport | P2 | B | — |
| F-29 | Natív csomagolás (Capacitor/TWA) | P2 | B | §13.6 |
| F-30 | GVH Árfigyelő integráció, ha lesz hivatalos adatforrás | P2 | A | §18.7 |
| F-31 | Passkey / biometrikus alkalmazászár | P2 | B | — |

### 3.2 Az „extra" (⭐) funkciók indoka — röviden

- **Katalógus + gyorsfelvétel (F-21):** az emlékeztető-felvétel a leggyakoribb művelet; „Netflix" begépelése → logó, kategória, tipikus ár kitöltve. Ez adja az „egyszerű" élményt *és* a tipp-motor alapját.
- **Műveletek az értesítésből (F-22):** a push-ból egy koppintással „Kifizettem" → a statisztikák pontosak maradnak anélkül, hogy az app megnyitása kellene.
- **ICS feed (F-16):** iOS-en a push korlátozott (csak telepített PWA, §12.9) — a naptár-feed *biztos tartalék*, ami minden platformon működik.
- **Próbaidő + árváltozás (F-19/20):** az előfizetések „csendes pénzfaló" esetei; ezek adják a leghasznosabb tippeket.
- **Árfolyam (F-18):** a streaming/SaaS díjak gyakran USD/EUR-ban jönnek; átváltás nélkül az összesítés hamis.
- **Digest (F-17):** heti egy értesítés > napi 5 — csökkenti a „kikapcsolom az egészet" kockázatát.

---

## 4. Felhasználói folyamatok

### J1 — Első látogatás → regisztráció
1. A felhasználó megnyitja az appot → nincs session → **átirányítás `/login`-ra** (a belépés az első, amit lát).
2. Az oldalon két fül: **Belépés | Regisztráció** (§14.4). Alul: nyelvváltó (HU/EN) és a „Telepítés" link (`/install`).
3. Regisztráció: név, e-mail, jelszó (min. 8 karakter, erősség-jelző), „Elfogadom az Adatkezelési tájékoztatót és ÁSZF-et" jelölőnégyzet, nyelv (a böngészőből előtöltve).
4. Beküldés után **„Nézd meg a leveled"** képernyő (újraküldés gomb 60 mp-es várakozással, „rossz e-mail? vissza").
5. Megérkezik a **személyre szabott e-mail** (§11) → gomb: *Fiók megerősítése* → `/auth/confirm` közbenső oldal („Megerősítem" gomb) → session → **onboarding** (§14.11).

### J2 — Belépés
E-mail + jelszó, **„Maradjak bejelentkezve"** (alapból bepipálva), „Elfelejtett jelszó?". Hibánál általános üzenet (nem árulja el, létezik-e a fiók). Nem megerősített e-mailnél: „Küldjük újra a megerősítő levelet?".

### J3 — Emlékeztető felvétele (a gazda példája) ⭐ kulcsforgatókönyv
*„Netflix — 2 300 Ft — havonta 10-én — 1 nappal előtte értesítsen."*

1. Dashboard → **„+"** (FAB) → *Új emlékeztető*.
2. A név mezőbe „Net…" → katalógus-javaslat **Netflix** (logó, kategória: Streaming, `is_subscription = true`) → koppintás kitölti a nevet/kategóriát; az összeg tipikus értéke *javaslat* (felülírható).
3. Összeg: `2300`, pénznem `HUF`.
4. Ismétlődés: **Havonta**, nap: **10.** (opció: „hónap utolsó napja").
5. Értesítés: **be**, **1 nappal előtte**, **09:00** (az alapértelmezés a profilból).
6. Mentés → a rendszer legenerálja a következő esedékességeket (rolling 120 nap) és az értesítési sort (§12.2).

**Golden példa** (a teszt-vektor — AI-A ezt építse pgTAP-ba, AI-B a form-előnézethez használja, 2026-10-13 a mai nap, időzóna `Europe/Budapest`):

| Esedékesség (`due_date`) | Értesítés ideje (`scheduled_for`, helyi idő) | Megjegyzés |
|---|---|---|
| 2026-11-10 | 2026-11-09 09:00 | első |
| 2026-12-10 | 2026-12-09 09:00 | |
| 2027-01-10 | 2027-01-09 09:00 | |

> A mai nap (okt. 13.) után a **következő** 10-e nov. 10. — az okt. 10. már elmúlt, arra nem jön értesítés.

### J4 — Értesítés érkezik → kifizetés
Push: **„Netflix — holnap esedékes"** / „2 300 Ft · nov. 10." + gombok: **Kifizettem** · **Holnap emlékeztess**. Koppintás az értesítésre → az app megnyílik az esedékesség-részleteknél (`/reminders/<id>?occ=<occId>`).

### J5 — Telepítés („Download")
Gomb a fejlécben/profilban/`/install` oldalon → platformtól függően: egy-koppintásos telepítés (Chromium), vagy lépésről lépésre útmutató (iOS/iPadOS Safari) (§13.3).

### J6 — Értesítések bekapcsolása
Profil → Értesítések → „Bekapcsolom ezen az eszközön" → böngésző-engedély → feliratkozás → **„Teszt-értesítés küldése"** gomb. iOS-en, ha nincs telepítve: előbb a telepítési útmutató (§12.9).

### J7 — Analytics / Költségkeretek / Tippek / Hírek
Alsó fül-sávból elérhető oldalak (§14.3). A tippek a dashboardon is megjelennek (max. 1–2 kártya), a hírek külön oldalon (`/news`).

### J8 — Elfelejtett jelszó
`/forgot-password` → e-mail megadása → mindig ugyanaz az üzenet („Ha létezik ilyen fiók, küldtünk levelet") → levél → `/auth/confirm?type=recovery` → `/reset-password` (új jelszó ×2, erősség-jelző) → siker → belépve, a többi eszközön a session megmarad vagy kijelentkeztetjük (opció: „Kijelentkezés minden eszközről").

### J9 — Fiók törlése
Profil → Veszélyzóna → „Fiók törlése" → jelszó-újrabevitel/megerősítő szöveg beírása → Edge Function `delete-account` → minden adat + avatar törlődik → búcsú képernyő.

---

## 5. Technológiai döntések (ADR)

### 5.1 Döntési táblázat

| # | Téma | Döntés | Indok / alternatíva |
|---|---|---|---|
| ADR-01 | Keretrendszer | **Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict** | A gazda által küldött Supabase-útmutató Next.js-re szól (`@supabase/ssr`, `next/headers`); a ClimarkAI is Next 16.2/React 19.2 → ismerős. „React oldal" = ez. Vite+React egyszerűbb lenne, de SSR-session és route-handlerek nélkül. |
| ADR-02 | Stílus | **Tailwind CSS v4** + CSS-változó tokenek (§14.2) + **shadcn/ui** (Radix) primitívek a repóba másolva (`components/ui`) | Gyors, egységes, a11y-barát. Ikon: `lucide-react`. Toast: `sonner`. Animáció: főleg CSS; `prefers-reduced-motion` tiszteletben tartva. |
| ADR-03 | Backend | **Supabase** (Auth, Postgres, Storage, Edge Functions, `pg_cron`, `pg_net`, Vault) | A gazda biztosítja a projektet. Külön szerver nincs. |
| ADR-04 | Adatelérés | **RSC + Server Actions + `@supabase/ssr` (cookie-session)**; nincs TanStack Query v1-ben; gyors UI-hoz `useOptimistic` | Egyszerűbb mentális modell, kevesebb kliens-JS. A kliens-Supabase csak ott, ahol kell (auth-űrlap, feltöltés). |
| ADR-05 | Validáció/űrlap | **zod 4** + **react-hook-form** (`@hookform/resolvers`); sémák közösen: `lib/schemas/*` | Ugyanaz a séma validál kliensen és Server Action-ben. |
| ADR-06 | i18n | **`next-intl`**, **URL-előtag nélkül** (cookie `NEXT_LOCALE` + `profiles.locale`), üzenetek: `locales/hu.json`, `locales/en.json` | A ClimarkAI futásidejű DOM-fordítója (MutationObserver + LLM-fordítás) **nem** megfelelő: pénzügyi szövegnél villog, költséges, nem determinisztikus. Tipizált kulcsok kellenek. |
| ADR-07 | Téma | **`next-themes`** (`attribute="class"`, `defaultTheme="system"`), profilba mentve | Villódzás-mentes (inline script). Világos az alap. |
| ADR-08 | Diagramok | **Recharts 3** saját wrapper-komponensek mögött; **validált** színpaletta (§15.3) | A ClimarkAI is Recharts 3.5. Minden diagramhoz hover-tooltip + táblázat-nézet. |
| ADR-09 | PWA / SW | **Kézzel írt `public/sw.js`** (nincs Serwist/next-pwa) | Next 16/Turbopack-kompatibilitási kockázat a pluginokkal; a ClimarkAI ~190 soros SW-je bizonyítja, hogy elég. Teljes kontroll a cache-szabály felett (§13.4). |
| ADR-10 | Push | **Web Push (VAPID)**, küldő: Edge Function; könyvtár: **spike (A-20)**: `jsr:@negrel/webpush` (Web Crypto, Deno) → tartalék `npm:web-push` | A `@negrel/webpush` saját README-je szerint „nem auditált" → éles előtt a spike döntse el, és az eredmény kerüljön a `DECISIONS.md`-be. Saját kripto-implementáció **nem** (a ClimarkAI-é precedens, de nem minta). |
| ADR-11 | Ütemező | **`pg_cron` + `pg_net` → Edge Function** (titok: Vault) | Vercel Hobby cron csak napi. A Supabase-oldali ütemezés a webes deploy-tól független. |
| ADR-12 | E-mail | Auth-levelek: **Supabase Auth + egyéni SMTP**; emlékeztető-levelek: ugyanazon szolgáltató HTTP API-ja az Edge Function-ből | 🔴 Az alap SMTP: **csak a szervezet csapattagjainak** küld, **2 levél/óra** (tesztre való) → éles regisztrációhoz egyéni SMTP **kötelező** (§10.5, §26-Q2). |
| ADR-13 | Hosting | **Vercel** (web), régió a Supabase-hez közel (`arn1` Stockholm / `fra1`) | HTTPS kötelező a PWA-hoz; ingyenes tier. |
| ADR-14 | Pénz | `numeric(14,2)`; alap-pénznem profilonként (alap: HUF); árfolyam: **Frankfurter (ECB)** naponta | Kerekítési hibák elkerülése (H9). HUF: 0 tizedes a megjelenítésben. |
| ADR-15 | Idő | Időbélyegek **UTC `timestamptz`**; esedékesség = **`date`** (naptári nap), a *felhasználó* időzónájában értelmezve; `scheduled_for = (due_date − offset) + remind_time` **`AT TIME ZONE`** | Nyári/téli időszámítás helyesen kezelve. |
| ADR-16 | Auth | **E-mail + jelszó**, PKCE, **`token_hash` + `/auth/confirm`** (SSR-barát); OAuth v1-ben nincs | „Semmi komoly nem kell". Google-belépés P2. |
| ADR-17 | Tippek | **Determinisztikus SQL-szabályok**; a DB *kódot + paramétert* tárol, a szöveg a `locales`-ból jön | Nincs kitalált szöveg, a fordítás egy helyen él (§17). |
| ADR-18 | Hírek | **Csak engedélyezőlistás kiadói RSS**; **nincs Google News RSS** | A Google News RSS fejléce szerint „személyes, nem kereskedelmi, hírolvasós" használatra való — egy appban sértené a feltételeket (ellenőrizve 2026-10-13). |
| ADR-19 | Tesztek | **Vitest** (+ Testing Library), **pgTAP** (`supabase test db`), **Playwright**, **axe-core** | §22 |
| ADR-20 | Csomagkezelő/Node | **npm**, Node ≥ 22 LTS | A gazda is npm-et használ. |

### 5.2 Verziók (kiindulás, a scaffold idején ellenőrizendő)

`next@^16`, `react@^19`, `tailwindcss@^4`, `@supabase/supabase-js@^2`, `@supabase/ssr@latest`, `zod@^4`, `recharts@^3`, `next-themes@^0.4`, `next-intl@^4`, `sonner@^2`, `lucide-react`, `react-hook-form@^7`, `vitest`, `@playwright/test`, `@axe-core/playwright`. A pontos verziót a `package.json` rögzíti; **ne** lépj főverziót munkamenet közben.

### 5.3 Amit a ClimarkAI-ból *tanulunk* (nem másolunk — H1)

A ClimarkAI mappa csak olvasható felmérése (2026-10-13) alapján:

| Téma | Ott | Nálunk |
|---|---|---|
| Service worker | `public/sw.js`, **csak push**, nincs `fetch` handler és nincs cache — *szándékosan*, hogy ne ragadjon be hitelesített HTML | Átvesszük az elvet: **hitelesített HTML-t sosem cache-elünk**; az offline élményhez csak statikus `/offline` oldal + statikus asset-ek (§13.4) |
| SW regisztráció | `register('/sw.js', { scope:'/', updateViaCache:'none' })`; `SW_VERSION` kommentet léptetnek a frissítéshez | Ugyanígy |
| Push-feliratkozás | `Notification.requestPermission()` **felhasználói gesztusból**; `pushsubscriptionchange` → újra-feliratkozás | Ugyanígy (§12.4–12.5) |
| iOS telepítés | Külön „Share → Add to Home Screen" sáv (nincs `beforeinstallprompt`); Chromiumon külön letöltés-oldal | Egy komponens (`InstallButton`) mindkettőt kezeli (§13.3) |
| Ikonok | Az `apple-touch-icon` **átlátszatlan** (iOS feketére festi az átlátszóságot); külön maszkolható ikonok; fehér-átlátszó Android badge | Ugyanígy (§13.2) |
| Display mód | `data-display-mode="standalone"` a `<html>`-en | Ugyanígy (használjuk „Maradjak bejelentkezve" és telepítés-gomb logikához) |
| Profilkép | Feltöltés szerverre, **nincs átméretezés**, publikus `avatars` bucket, cache-bust `?t=` | Javítjuk: **kliens-oldali 256×256 WebP átméretezés** + szerver-oldali magic-byte ellenőrzés (§19.2) |
| Téma/nyelv | Egyedi context + localStorage + szerver-szinkron | `next-themes` + `next-intl` + profil-szinkron (§20) |
| Elrendezés | Üveg-hatású oldalsáv + felső sáv; **nincs alsó fül-sáv** | Nekünk **kell** alsó fül-sáv mobilra (§14.3) |
| Betűtípus | Comfortaa | **Inter** (vagy hasonló) `latin` + **`latin-ext`** subsettel — ez kell az **ő/ű** karakterekhez 🔴 |
| Konvenciók | Typecheck 0 hiba; guard-tesztek; HU+EN minden szöveg; LF; egy forrás az ismétlődő értékekre | H11 |

---

## 6. Rendszerarchitektúra

### 6.1 Áttekintő ábra

```
┌──────────────────────────── ESZKÖZÖK (telefon · tablet · laptop · PC) ───────────────────────────┐
│  Böngésző / telepített PWA                                                                        │
│  ┌───────────────┐   ┌────────────────┐   ┌──────────────────────┐                               │
│  │ Next.js UI    │   │ Service Worker │   │ Push Service (FCM /  │◄──── titkosított push ──┐     │
│  │ (React 19)    │◄─►│ public/sw.js   │◄──│ Mozilla / Apple /WNS)│                         │     │
│  └──────┬────────┘   └────────────────┘   └──────────────────────┘                         │     │
└─────────┼─────────────────────────────────────────────────────────────────────────────────┼─────┘
          │ HTTPS (cookie-session)                                                           │
┌─────────▼───────────┐        ┌──────────────────────────────────────────────────────────────┴─────┐
│  VERCEL (AI-B)      │        │  SUPABASE  ddvzslgwexvdolovqqlg   (AI-A)                           │
│  Next.js 16         │  SQL/  │  ┌────────┐ ┌───────────────┐ ┌─────────┐ ┌───────────────────┐   │
│  • RSC + Server     │  RPC   │  │ Auth   │ │ Postgres + RLS│ │ Storage │ │ Edge Functions    │   │
│    Actions          ├───────►│  │ (SMTP) │ │ tables, RPC,  │ │ avatars │ │ send-notifications│   │
│  • proxy.ts (session│        │  │        │ │ triggers      │ │         │ │ news-ingest       │   │
│    refresh)         │        │  └────────┘ └──────▲────────┘ └─────────┘ │ fx-refresh        │   │
│  • route handlers   │        │                    │ pg_cron + pg_net     │ delete-account    │   │
│    (ICS, SW actions)│        │              ┌─────┴──────┐               │ send-test-push    │   │
└─────────────────────┘        │              │ Ütemezések │──────────────►└─────────┬─────────┘   │
                               │              └────────────┘                         │             │
                               └─────────────────────────────────────────────────────┼─────────────┘
                                                                                     │
        ┌──────────────────┬─────────────────────┬───────────────────────────────────┤
        ▼                  ▼                     ▼                                   ▼
  Push-szolgáltatók   SMTP/E-mail API      Kiadói RSS-ek                    Frankfurter (ECB) FX
  (VAPID, RFC 8030)   (egyéni SMTP)        (Pénzcentrum, Portfolio,         api.frankfurter.dev
                                           Telex, Index, HVG…)
```

### 6.2 Fő adatfolyamok

**F1 — Auth.** Böngésző → `/signup` → Server Action `signUp()` (`supabase.auth.signUp`, metaadat: `display_name`, `locale`) → Supabase Auth e-mailt küld (egyéni SMTP, személyre szabott sablon) → felhasználó a levélben a gombra kattint → `/auth/confirm?token_hash=…&type=signup` (közbenső oldal, *gombnyomásra* `verifyOtp`) → session-cookie → DB trigger `handle_new_user()` már létrehozta a `profiles` sort.

**F2 — Emlékeztető CRUD.** UI → Server Action → `supabase.from('reminders')` (RLS: csak saját) → trigger/RPC `ensure_occurrences(reminder_id)` legenerálja a következő 120 nap esedékességeit → `rebuild_notification_queue(reminder_id)` beírja a `notifications` sort (`pending`).

**F3 — Értesítés (a rendszer szíve).** `pg_cron` percenként → `pg_net` POST → Edge Function `send-notifications` (titkos fejléc) → `claim_due_notifications(limit)` (`FOR UPDATE SKIP LOCKED`) → csatornánként: **push** (VAPID, minden feliratkozott eszközre) / **e-mail** (opció) → státusz `sent`/`failed`/`expired`; halott feliratkozás (404/410) → letiltás. **In-app** értesítés = ugyanazon sor `channel='in_app'` — nincs külső küldés.

**F4 — Hírek.** `pg_cron` 30 percenként → Edge Function `news-ingest` → engedélyezőlistás RSS-ek letöltése (`ETag`/`If-Modified-Since`) → tisztítás, deduplikálás, témaosztályozás, **lejárat** számítása → `news_items`.

**F5 — Árfolyam.** `pg_cron` munkanapokon → `fx-refresh` → Frankfurter → `fx_rates`.

**F6 — Tippek.** `pg_cron` éjjel → `refresh_tips_all()`; felhasználói kérésre `refresh_tips()` RPC. A UI csak olvas.

**F7 — Naptár-feed.** Külső naptár-app `GET /api/ics/<token>.ics` → route handler → `ics_feed(token)` RPC (`security definer`, `anon`-nak engedve, token = 192 bit, forgatható).

### 6.3 Ütemezések (`pg_cron`, UTC)

| Job | Cron | Mit csinál | Tulaj |
|---|---|---|---|
| `occurrences_daily` | `15 2 * * *` | `ensure_occurrences_all()` + `rebuild_notification_queue_all()` | A |
| `enqueue_extras` | `*/5 * * * *` | `enqueue_extra_notifications()` — lejárt-tétel, próbaidő, heti digest sorok | A |
| `send_notifications` | `* * * * *` | `pg_net` → `send-notifications` | A |
| `news_ingest` | `*/30 * * * *` | `pg_net` → `news-ingest` | A |
| `fx_refresh` | `30 16 * * 1-5` | `pg_net` → `fx-refresh` (az ECB ~16:00 CET körül publikál) | A |
| `tips_nightly` | `30 3 * * *` | `refresh_tips_all()` | A |
| `cleanup_daily` | `0 4 * * *` | régi `notifications` (>90 nap), lejárt `news_items` (>60 nap), letiltott feliratkozások (>30 nap) törlése | A |

> **Titok az ütemezéshez:** `CRON_SECRET` a **Supabase Vault**-ban; a `cron.schedule` SQL a `vault.decrypted_secrets`-ből olvassa, és `Authorization`/`x-cron-secret` fejlécben küldi. Az Edge Function ezt ellenőrzi (`--no-verify-jwt` + saját ellenőrzés). **Titok nem kerül a migrációs fájlba** — a migráció csak a Vault-bejegyzés *nevét* hivatkozza; a értéket a gazda/AI-A egyszer, kézzel írja be (A-18).

### 6.4 Skálázási/limit-realitások (Free csomag)

- A **Free** projekt **1 hét inaktivitás után szünetel (pause)** → szünetelő projekt **nem küld emlékeztetőt**. Személyes/teszt használatra elfogadható; éles indulás előtt **Pro** csomag (vagy rendszeres aktivitás) kell. (§26-R1)
- Nano compute, 500 MB DB, Edge Functions havi 500k hívás: percenkénti cron ≈ 43k hívás/hó → belefér.
- Nincs napi automatikus backup a Free csomagon → `export_my_data` + időszakos `pg_dump` a gazdánál (§23.5).

---

## 7. Repo-struktúra és fájl-tulajdon

### 7.1 Célstruktúra

```
Bank_Reminder/
├─ ARCHITECTURE.md                  ← ez a fájl (közös; §25 szerint módosítható)
├─ CLAUDE.md                        ← rövid „olvass el + kemény szabályok" (mindkét AI betölti)
├─ README.md  .env.example  .gitignore  .gitattributes
├─ package.json  tsconfig.json  next.config.ts  eslint.config.mjs
├─ vitest.config.mts  playwright.config.ts
├─ proxy.ts                         ← Next 16: session-frissítés + védett útvonalak              [B]
├─ docs/
│  ├─ reference/                    ← 4 db referencia-kép                                         [kész]
│  ├─ STATUS.md  CONTRACT_CHANGES.md  DECISIONS.md                                                [AB]
├─ supabase/                                                                                      [A]
│  ├─ config.toml
│  ├─ migrations/                   ← időbélyeges .sql fájlok (egyetlen igazság a sémára)
│  ├─ seed/                         ← categories.sql · service_catalog.sql · news_sources.sql
│  ├─ functions/
│  │  ├─ _shared/                   ← supabase.ts · auth.ts · webpush.ts · email.ts · i18n.ts · rss.ts · log.ts
│  │  ├─ send-notifications/  news-ingest/  fx-refresh/  delete-account/  send-test-push/
│  ├─ tests/                        ← pgTAP (*.test.sql)
│  └─ email-templates/              ← confirm-signup.html · recovery.html · email-change.html · reauth.html · magic-link.html · invite.html · password-changed.html
├─ scripts/
│  ├─ assert-project.mjs  gen-vapid.mjs  db-types.mjs                                             [A]
│  └─ gen-icons.mjs                                                                               [B]
├─ types/database.types.ts          ← A generálja (`npm run db:types`), B olvassa
├─ utils/supabase/                  ← client.ts · server.ts · middleware.ts (a gazda útmutatója szerint) [B]
├─ app/                                                                                           [B]
│  ├─ layout.tsx  globals.css  manifest.ts  not-found.tsx  error.tsx
│  ├─ (public)/install/  privacy/  terms/
│  ├─ (auth)/login/  signup/  forgot-password/  reset-password/  check-email/
│  ├─ auth/confirm/  (page + action)    auth/callback/route.ts
│  ├─ (app)/layout.tsx              ← védett shell: fejléc + oldalsáv/alsó fül-sáv
│  │  ├─ dashboard/  reminders/(new, [id], [id]/edit)  calendar/  analytics/
│  │  ├─ budgets/  savings/  tips/  news/([id])  notifications/  profile/  onboarding/
│  └─ api/
│     ├─ push/subscribe/  push/unsubscribe/
│     ├─ occurrences/[id]/paid/  occurrences/[id]/snooze/      ← SW értesítés-műveletekhez
│     ├─ ics/[token]/  export/  health/
├─ components/
│  ├─ ui/                           ← shadcn primitívek
│  ├─ charts/                       ← DonutChart · TrendBars · CumulativeLine · TopBars · Sparkline · ChartTable
│  ├─ reminders/  budgets/  savings/  tips/  news/  profile/  shell/  install/  push/
├─ lib/
│  ├─ brand.ts  format.ts  schemas/  fixtures/  push-client.ts  install.ts  haptics.ts ...
├─ locales/  hu.json  en.json                                                                    [B]
├─ public/  sw.js  offline.html (önálló, JS-mentes)  icons/ (apple-touch, maskable, badge)       [B]
└─ tests/  unit/  e2e/  a11y/                                                                     [B]
```

### 7.2 Tulajdon-táblázat

| Terület | Tulaj | Megjegyzés |
|---|---|---|
| `supabase/**` (migrációk, seed, Edge Function-ök, pgTAP, e-mail sablonok) | **AI-A** | B ide **nem ír**. |
| `scripts/assert-project.mjs`, `gen-vapid.mjs`, `db-types.mjs` | **AI-A** | |
| `types/database.types.ts` | **AI-A generálja** | B csak olvassa; kézzel nem szerkeszthető. |
| `utils/supabase/*`, `proxy.ts`, `app/**`, `components/**`, `lib/**`, `locales/**`, `public/**`, `tests/**`, `scripts/gen-icons.mjs` | **AI-B** | A ide **nem ír** (kivétel: `lib/fixtures` mintaadatot A *javasolhat* a `docs/CONTRACT_CHANGES.md`-ben). |
| `ARCHITECTURE.md`, `CLAUDE.md`, `docs/STATUS.md`, `docs/CONTRACT_CHANGES.md`, `docs/DECISIONS.md`, `.env.example`, `package.json` | **közös** | §7.3 |

### 7.3 Közös fájlok szabálya

- `package.json`: **B a gazdája.** AI-A csak a `scripts` szekcióba a saját `db:*`/`functions:*` parancsait és `devDependencies`-be a saját eszközeit (pl. `supabase` CLI) veheti fel, **külön commitban**, `[A]` előtaggal. Függőség-verziót a másik nem módosít.
- `.env.example`: új változót az vesz fel, aki bevezeti; a Függelék A-t is frissíti.
- `ARCHITECTURE.md`: csak pontosítás/javítás; szerződés-változás → előbb `CONTRACT_CHANGES.md` (§25).

### 7.4 npm szkriptek (kötelező nevek)

| Szkript | Mit csinál | Ki hozza létre |
|---|---|---|
| `dev` · `build` · `start` | Next | B |
| `typecheck` · `lint` · `test` · `test:e2e` · `test:a11y` | minőségkapuk | B |
| `db:assert` | `node scripts/assert-project.mjs` (H2) | A |
| `db:types` | `supabase gen types typescript --project-id ddvzslgwexvdolovqqlg > types/database.types.ts` (a `db:assert` után) | A |
| `db:test` | `supabase test db` (pgTAP) | A |
| `db:push` | `db:assert && supabase db push` — **csak gazdai jóváhagyással** (H5) | A |
| `fn:serve` · `fn:deploy` | Edge Function helyi futtatás / deploy (`db:assert` előzi meg) | A |
| `gen:vapid` | VAPID kulcspár generálása (kimenet: stdout, **nem fájl**) | A |
| `gen:icons` | PWA ikonok egyetlen SVG-ből | B |

### 7.5 Elnevezési és stílus-szabályok

- Fájlok: `kebab-case.ts(x)`; React komponens: `PascalCase`; hook: `useXyz`; Server Action fájl: `actions.ts` az útvonal mellett (`'use server'`).
- DB: `snake_case`, többes számú táblanevek, enum helyett **`text` + `check`** (egyszerűbb migrálni).
- Nincs `any`; a DB-típus a `database.types.ts`-ből (`Tables<'reminders'>`).
- Egy forrás az ismétlődő értékekre (pl. `lib/constants.ts`: `OFFSET_CHOICES`, `MAX_AVATAR_BYTES`, localStorage-kulcsok).

---

## 8. Adatmodell (Postgres)

> **Státusz:** *referencia-séma* (**szerződés v0**). Az AI-A ebből írja a migrációkat; ha a migráció és ez a fejezet eltér, **a migráció + `CONTRACT_CHANGES.md` bejegyzés** az új igazság. A SQL itt a szándékot rögzíti — a pontos szintaxist (extension-sémák, `search_path`) az AI-A ellenőrzi a futó projekten *(előbb H2!)*.

### 8.1 Elvek

- Séma: `public`. Minden tábla `id uuid primary key default gen_random_uuid()` (kivéve ahol más a természetes kulcs).
- Minden felhasználói tábla: `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()` → fiók-törléskor mindent viszi a kaszkád.
- `created_at`/`updated_at timestamptz` + `set_updated_at()` trigger.
- Enum helyett `text` + `check`.
- Összeg: `numeric(14,2)`, pénznem: `char(3)` ISO-4217, nagybetű (`check (currency ~ '^[A-Z]{3}$')`).
- Naptári nap: `date`; időpont: `timestamptz` (UTC).
- Indexek: minden FK-ra + a lekérdezési minták szerint (lent).

### 8.2 Kiterjesztések

```sql
create extension if not exists pg_cron;   -- ütemezés (Dashboard → Database → Extensions)
create extension if not exists pg_net;    -- HTTP a cron-ból az Edge Function-ökhöz
-- Vault (supabase_vault): CRON_SECRET tárolásához — Dashboard → Integrations → Vault
-- ICS-token: replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')  (nem kell pgcrypto)
```

### 8.3 Táblák

#### `profiles` — 1:1 az `auth.users`-szel

```sql
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text check (char_length(display_name) <= 60),
  avatar_path           text,                                   -- 'avatars' bucket relatív útvonal
  locale                text not null default 'hu' check (locale in ('hu','en')),
  theme                 text not null default 'system' check (theme in ('system','light','dark')),
  base_currency         char(3) not null default 'HUF',
  timezone              text not null default 'Europe/Budapest',  -- IANA; az onboarding a böngészőből tölti
  reminders_enabled     boolean not null default true,            -- GLOBÁLIS kapcsoló (a gazda kérése)
  default_offsets       smallint[] not null default '{1}',        -- nappal előtte
  default_notify_time   time not null default '09:00',
  channel_push          boolean not null default true,
  channel_email         boolean not null default false,
  notify_hide_details   boolean not null default false,           -- zárolt képernyőn ne írja ki a nevet/összeget (§12.3)
  weekly_digest         boolean not null default true,
  tips_enabled          boolean not null default true,
  news_enabled          boolean not null default true,
  monthly_income        numeric(14,2) check (monthly_income >= 0),-- opcionális (megtakarítási ráta tippekhez)
  ics_token             text not null unique
                          default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  onboarding_done       boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
```

Trigger: **új felhasználó → profil** (a regisztrációs metaadatból):

```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'display_name','')), 60), ''),
    case when new.raw_user_meta_data->>'locale' in ('hu','en')
         then new.raw_user_meta_data->>'locale' else 'hu' end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

#### `categories` — rendszer- és saját kategóriák

```sql
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,   -- NULL = rendszer-kategória
  key         text,                                               -- rendszer: 'streaming', 'rent' … (Függelék C)
  name_hu     text, name_en text,
  icon        text not null default 'tag',                        -- lucide ikonnév
  color_slot  smallint not null default 8 check (color_slot between 1 and 9), -- §15.3; 9 = „egyéb" szürke
  kind        text not null default 'both' check (kind in ('bill','expense','both')),
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  check (name_hu is not null or name_en is not null)
);
create unique index categories_system_key on public.categories (key) where user_id is null;
create index categories_user on public.categories (user_id);
```

#### `service_catalog` — szolgáltatás-katalógus (rendszer, csak olvasható)

```sql
create table public.service_catalog (
  slug                text primary key,                 -- 'netflix', 'hbo-max', 'spotify' …
  name                text not null,
  category_key        text not null,                    -- categories.key
  group_key           text,                             -- átfedés-csoport: 'video_streaming','music_streaming','cloud_storage'…
  logo_url            text, website text,
  typical_amount      numeric(14,2), typical_currency char(3), typical_unit text default 'month' check (typical_unit in ('month','year')),
  annual_discount_pct numeric(5,2),                     -- ha van éves csomag-kedvezmény (becslés!)
  family_plan         boolean not null default false,
  unique_tags         text[] not null default '{}',     -- „csak itt van" jellegű tartalomcímkék (curated)
  common_tags         text[] not null default '{}',     -- általános (film, sorozat, gyerek, sport…)
  verified_at         date not null,                    -- 🔴 minden katalógus-adat dátumozott (H7)
  source_url          text,
  is_active           boolean not null default true
);
```

> A `typical_amount`/`unique_tags`/`annual_discount_pct` **becslések**, a UI „Becsült, frissítve: 2026-10" jelöléssel mutatja. Az AI-A seed-fájlja **csak ellenőrizhető adatot** tartalmazzon (szolgáltató hivatalos árlistája, dátummal); amit nem tud ellenőrizni, hagyja `null`-on.

#### `reminders` — az emlékeztető (a *szabály*)

```sql
create table public.reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name             text not null check (char_length(name) between 1 and 80),
  amount           numeric(14,2) not null check (amount >= 0),
  currency         char(3) not null default 'HUF' check (currency ~ '^[A-Z]{3}$'),
  category_id      uuid references public.categories(id) on delete set null,
  service_slug     text references public.service_catalog(slug) on delete set null,
  is_subscription  boolean not null default false,
  -- ismétlődés (NULL unit = egyszeri)
  recur_unit       text check (recur_unit in ('day','week','month','year')),
  recur_every      smallint not null default 1 check (recur_every between 1 and 60),
  start_date       date not null,                               -- az első esedékesség (horgony)
  month_end        boolean not null default false,              -- „hónap utolsó napja"
  end_date         date,                                        -- opcionális lezárás
  trial_ends_on    date,                                        -- ingyenes próba vége (F-19)
  -- értesítés
  remind_enabled   boolean not null default true,               -- EMLÉKEZTETŐNKÉNTI be/ki
  remind_offsets   smallint[] not null default '{1}',           -- nappal előtte; 0 = aznap
  remind_time      time not null default '09:00',
  channels         text[] not null default '{push}',            -- 'push','email' ('in_app' mindig)
  auto_paid        boolean not null default false,              -- csoportos beszedés: esedékességkor automatikusan „kifizetve"
  note             text check (char_length(note) <= 500),
  url              text check (url ~ '^https?://'),
  usage_tags       text[] not null default '{}',                -- „miért tartom meg" (tipp-motor, §17)
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (recur_unit is not null or recur_every = 1),
  check (end_date is null or end_date >= start_date),
  check (cardinality(remind_offsets) <= 5 and 0 <= all(remind_offsets) and 30 >= all(remind_offsets)),
  check (channels <@ array['push','email']::text[])
);
create index reminders_user_active on public.reminders (user_id) where is_active;
```

#### `occurrences` — egy konkrét esedékesség (az analitika és az értesítés alapja)

```sql
create table public.occurrences (
  id             uuid primary key default gen_random_uuid(),
  reminder_id    uuid not null references public.reminders(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  due_date       date not null,
  amount         numeric(14,2) not null,          -- a keletkezéskori összeg (árváltozás-előzmény!)
  currency       char(3) not null,
  status         text not null default 'upcoming' check (status in ('upcoming','paid','skipped')),
  paid_on        date,                            -- a kifizetés napja (felhasználói időzóna)
  paid_amount    numeric(14,2),                   -- ha eltér a tervezettől
  paid_at        timestamptz,
  snoozed_until  timestamptz,
  created_at     timestamptz not null default now(),
  unique (reminder_id, due_date)
);
create index occurrences_user_due on public.occurrences (user_id, due_date);
create index occurrences_user_status on public.occurrences (user_id, status, due_date);
```

**„Lejárt" (overdue) = levezetett állapot**, nem tárolt: `status = 'upcoming' and due_date < (now() at time zone profile.timezone)::date`.

#### `expenses` — gyors egyszeri kiadás (F-12)

```sql
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'HUF',
  spent_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index expenses_user_date on public.expenses (user_id, spent_on);
```

#### `budgets`, `savings_goals`, `goal_contributions`

```sql
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  currency char(3) not null default 'HUF',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency char(3) not null default 'HUF',
  target_date date,
  icon text not null default 'piggy-bank',
  color_slot smallint not null default 1 check (color_slot between 1 and 8),
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  amount numeric(14,2) not null check (amount <> 0),       -- negatív = kivét
  contributed_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
```

Nézet: `savings_goals_progress` (`security_invoker = true`): `saved = coalesce(sum(amount),0)`, `pct`, `needed_per_month` (a `target_date`-ig).

#### `push_subscriptions` — eszközönként egy sor

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null, auth text not null,
  platform text check (platform in ('ios','android','windows','macos','linux','other')),
  user_agent text, label text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  failed_count smallint not null default 0,
  disabled_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions (user_id) where disabled_at is null;
```

🔴 **SSRF-védelem:** az `endpoint` felhasználó által megadott URL, amire a szerver POST-ol. Beszúráskor (Server Action *és* DB-`check`/trigger) csak **https** és engedélyezőlistás host-végződés: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`, `web.push.apple.com`. Más → elutasítva.

#### `notifications` — sor + beérkezett üzenetek (egy tábla)

```sql
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('reminder','overdue','trial_end','digest','tip','news','system')),
  channel        text not null check (channel in ('push','email','in_app')),
  reminder_id    uuid references public.reminders(id) on delete cascade,
  occurrence_id  uuid references public.occurrences(id) on delete cascade,
  payload        jsonb not null default '{}',     -- strukturált adat; a SZÖVEG küldéskor/megjelenítéskor készül a felhasználó nyelvén
  scheduled_for  timestamptz not null,
  status         text not null default 'pending'
                   check (status in ('pending','sending','sent','failed','expired','cancelled')),
  attempts       smallint not null default 0,
  claimed_at     timestamptz,
  next_attempt_at timestamptz,
  last_error     text,
  sent_at        timestamptz,
  read_at        timestamptz,
  dedupe_key     text not null unique,
  created_at     timestamptz not null default now()
);
create index notifications_due on public.notifications (scheduled_for) where status in ('pending','failed','sending');
create index notifications_inbox on public.notifications (user_id, scheduled_for desc) where channel = 'in_app';
```

`payload` példa (reminder): `{"name":"Netflix","amount":2300,"currency":"HUF","due_date":"2026-11-10","offset":1,"occ":"<uuid>"}`.

**Dedupe-kulcsok:** `rem:<occurrenceId>:<offset>:<channel>` · `ovd:<occurrenceId>:<k>` · `trial:<reminderId>:<date>` · `digest:<userId>:<isoYear-Www>`.

#### `fx_rates`, `tips`, `news_*`

```sql
create table public.fx_rates (                 -- EUR bázisú (Frankfurter/ECB); EUR = 1 implicit
  as_of date not null, currency char(3) not null, per_eur numeric(18,8) not null,
  primary key (as_of, currency)
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,                          -- §17 szabálykód, pl. 'sub_overlap_group'
  severity text not null default 'info' check (severity in ('info','save','warn')),
  params jsonb not null default '{}',          -- a szöveg változói (összeg, név…)
  est_monthly_saving numeric(14,2),            -- becsült havi megtakarítás (alap-pénznemben)
  reminder_ids uuid[] not null default '{}',
  fingerprint text not null,                   -- stabil azonosító: ugyanaz a tipp ne duplikálódjon
  status text not null default 'new' check (status in ('new','seen','dismissed','snoozed','done')),
  snoozed_until date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create table public.news_sources (
  key text primary key, name text not null, feed_url text not null, home_url text not null,
  topic_hint text check (topic_hint in ('deals','utilities','banking','saving','prices','general')),
  enabled boolean not null default true,
  etag text, last_modified text, last_fetched_at timestamptz, last_status int, last_error text,
  license_note text
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.news_sources(key),
  url text not null unique,
  title text not null check (char_length(title) <= 300),
  snippet text check (char_length(snippet) <= 400),     -- ≤ ~200 karakter ajánlott (idézet, nem cikk)
  image_url text,
  topic text not null check (topic in ('deals','utilities','banking','saving','prices','general')),
  score smallint not null default 0,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,                      -- 🔴 minden tételnek van lejárata (§18.2, §18.3)
  is_hidden boolean not null default false
);
create index news_items_feed on public.news_items (topic, published_at desc) where not is_hidden;

create table public.news_reports (                      -- „hibásnak tűnik" jelentés
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('outdated','wrong','spam','other')),
  created_at timestamptz not null default now(),
  unique (news_id, user_id)
);
```

### 8.4 Az ismétlődés pontos szemantikája (🔴 teszt-vektorokkal)

`occurrence_dates(unit, every, start, month_end, from, to, end)` → `setof date`. **Egyetlen megvalósítás: SQL (AI-A).** A kliens előnézethez az `preview_dates(...)` RPC-t hívja (nem port-olunk TS-be → nincs drift).

Szabályok:
- `unit IS NULL` → egyszeri: csak `start_date`.
- `day` / `week`: `start + n·every·(1 | 7)` nap.
- `month` / `year`: a **horgony-nap** (`extract(day from start)`) *nem sodródik*: az n-edik dátum = a cél hónap `least(horgony-nap, hónap-napjai)`-adik napja; `month_end = true` esetén mindig a hónap utolsó napja. `year` = `month` × 12.
- Az eredmény mindig `>= start_date` és `<= end_date` (ha van).

| # | Bemenet | Várt kimenet |
|---|---|---|
| V1 | `month`,1, start `2026-01-31` | 2026-01-31 · 2026-02-28 · 2026-03-31 · 2026-04-30 · 2026-05-31 |
| V2 | `month`,1, start `2026-01-30`, `month_end=true` | 2026-01-31 · 2026-02-28 · 2026-03-31 |
| V3 | `year`,1, start `2024-02-29` | 2024-02-29 · 2025-02-28 · 2026-02-28 · 2027-02-28 · 2028-02-29 |
| V4 | `week`,2, start `2026-10-13` | 2026-10-13 · 2026-10-27 · 2026-11-10 |
| V5 | `NULL`, start `2026-11-10` | 2026-11-10 |
| V6 | `month`,3, start `2026-11-15` | 2026-11-15 · 2027-02-15 · 2027-05-15 |
| V7 | `day`,10, start `2026-10-13` | 2026-10-13 · 2026-10-23 · 2026-11-02 |

**Értesítési időpont-vektorok** (`Europe/Budapest`, `remind_time = 09:00`, offset 1):

| due_date | `scheduled_for` (UTC) | Miért érdekes |
|---|---|---|
| 2026-11-10 | 2026-11-09 08:00Z | normál (CET, UTC+1) |
| 2026-10-25 | 2026-10-24 07:00Z | még nyári idő (CEST, UTC+2) |
| 2026-10-26 | 2026-10-25 08:00Z | **téli időszámítás kezdete** (okt. 25. 03:00→02:00) — a nap 09:00 már CET |
| 2026-03-29 | 2026-03-28 08:00Z | tavaszi óraátállítás előtti nap (CET) |
| 2026-03-30 | 2026-03-29 07:00Z | **nyári időszámítás kezdete** (márc. 29.) — 09:00 már CEST |

### 8.5 Állapotváltások és mellékhatások

| Esemény | Hatás |
|---|---|
| `reminders` INSERT/UPDATE | `ensure_occurrences(id)` (a jövőbeli, `upcoming` esedékességeket újraszámolja: a megváltozott szabály szerint törli/pótolja; **a `paid`/`skipped` múltbeli sorokat nem bántja**) → `rebuild_notification_queue(id)` |
| `reminders.is_active = false` | jövőbeli `upcoming` esedékességek törlése, `pending` értesítések `cancelled` |
| `mark_paid(occ)` | `status='paid'`, `paid_on` (alap: ma a felhasználó időzónájában), `paid_at=now()`; a `pending` értesítések `cancelled`; árváltozás-ellenőrzés (§17) |
| `mark_unpaid(occ)` (visszavonás) | `status='upcoming'`; értesítések újraépítése (ha a határidő még a jövőben) |
| `skip_occurrence(occ)` | `status='skipped'`; értesítések `cancelled` |
| `snooze_occurrence(occ, until)` | `snoozed_until` beállítva; **új** `reminder` értesítés `until`-ra (dedupe: `snz:<occ>:<epoch>`) |
| `reminders.auto_paid` + esedékesség napja | a napi job automatikusan `paid`-re állítja (`paid_on = due_date`) |
| `profiles.reminders_enabled = false` | küldéskor (claim) minden értesítés `cancelled` — a kapcsoló **azonnali**, nem a sor-építéskor érvényesül |
| Összeg-módosítás | csak a **jövőbeli `upcoming`** esedékességek összege frissül; a múlt változatlan (így marad meg az árelőzmény) |

### 8.6 Rendszer-kategóriák

Lásd **Függelék C** (kulcsok, nevek HU/EN, ikon, színslot). Seed: `supabase/seed/categories.sql` (**A-08**).

### 8.7 Pénznem és árfolyam

```sql
-- fx_convert(amount, from, to, on_date): EUR-keresztárfolyammal; ha az adott napra nincs adat → a legközelebbi korábbi nap.
-- from = to → amount változatlan. Hiányzó árfolyam → NULL (a UI „n/a"-t mutat, nem 0-t).
```
- Analitika: **aktuális alap-pénznem** szerinti összegzés; a kifizetett tételek a **`paid_on`** napi, a tervezettek a **`due_date`** napi árfolyamon (ha az még nincs, a legutolsón).
- A UI minden nem-alap pénznemű tételnél mutatja az eredeti összeget + „≈ X Ft" átváltást.

### 8.8 Storage

- Bucket: **`avatars`** — publikus olvasás, **írás csak a saját mappába** `<uid>/<uuid>.webp`; `file_size_limit = 2 MB`; `allowed_mime_types = image/webp, image/jpeg, image/png`.
- Policy (INSERT/UPDATE/DELETE): `bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text`.
- A fájlnév véletlen UUID → nem kitalálható; csere esetén a régi fájl törlődik.

---

## 9. Biztonság, RLS, adatvédelem

### 9.1 RLS-minta (minden felhasználói táblára)

```sql
alter table public.reminders enable row level security;

create policy "own rows: select" on public.reminders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.reminders for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.reminders for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.reminders for delete to authenticated
  using ((select auth.uid()) = user_id);
```

> A `(select auth.uid())` forma **kötelező** (az optimalizáló egyszer értékeli ki, nem soronként).

### 9.2 Táblánkénti jogosultsági mátrix

| Tábla | `authenticated` | `anon` | `service_role` (Edge Function) |
|---|---|---|---|
| `profiles` | select/update **saját** sor (insert/delete nem: trigger/kaszkád) | — | teljes |
| `categories` | select: rendszer (`user_id is null`) + saját; insert/update/delete: csak saját | — | teljes |
| `service_catalog` | select | — | teljes |
| `reminders`, `occurrences`*, `expenses`, `budgets`, `savings_goals`, `goal_contributions` | CRUD **saját** | — | teljes |
| `push_subscriptions` | select/delete saját; insert saját + endpoint-allowlist | — | teljes |
| `notifications` | select **csak saját `in_app`**; update **csak `read_at`** oszlop (column grant) | — | teljes |
| `tips` | select saját; update `status`, `snoozed_until` (column grant) | — | teljes |
| `fx_rates` | select | — | teljes |
| `news_sources` | — | — | teljes |
| `news_items` | select: `not is_hidden and expires_at > now()` | — | teljes |
| `news_reports` | insert saját; select saját | — | teljes |

\* `occurrences`: a kliens **közvetlenül nem módosítja** az állapotot — csak az RPC-kön át (`mark_paid` stb.), hogy a mellékhatások (§8.5) garantáltak legyenek. Direkt `update` jog: **nincs** (csak `select`); az RPC `security definer`, de `auth.uid()`-vel ellenőriz.

### 9.3 `security definer` fegyelem 🔴

- Mindig: `set search_path = ''`, minden objektum **séma-minősített** (`public.reminders`, `auth.uid()`).
- Mindig: `revoke execute on function … from public, anon;` majd csak a szükséges szerepkörnek `grant execute`.
- A függvény **első sora**: `if auth.uid() is null then raise exception 'not authenticated'; end if;` (ahol felhasználói hívás).
- Cron/Edge-függvények (pl. `ensure_occurrences_all`, `claim_due_notifications`): `grant execute … to service_role` **csak**.
- Egyetlen kivétel az `anon`-nak: `ics_feed(token)` (csak a tokenhez tartozó felhasználó *minimális* mezőit adja: név, dátum, összeg, pénznem; a token-kitalálás ellen 192+ bit entrópia).

### 9.4 Adatvédelem (GDPR) — kötelező minimum

| Elem | Követelmény |
|---|---|
| Jogalap, tájékoztató | `/privacy` (Adatkezelési tájékoztató) és `/terms` (ÁSZF) oldal; **a jogi szöveget a gazda adja** (a ClimarkAI-ban lévő jogi anyagokat **nem** olvassuk/másoljuk). A fejlesztés addig *placeholder*-t tesz fel, kétnyelvűen, jól látható „TERVEZET" jelzéssel. |
| Hozzájárulás | Regisztrációnál kötelező jelölőnégyzet (nem előre bepipált). A push-engedély külön, *felhasználói gesztusra* kért. |
| Adat-export | **F-25**: Profil → „Adataim letöltése" → `export_my_data()` → JSON (+ emlékeztetők/kiadások CSV). |
| Törlés | **F-25**: Profil → „Fiók törlése" → Edge Function `delete-account` (JWT-ellenőrzés → avatar-fájlok törlése → `auth.admin.deleteUser` → kaszkád). Visszavonhatatlan, megerősítéssel. |
| Adatminimalizálás | Csak ami kell: e-mail, név (opcionális), emlékeztetők. **Nincs** bankszámlaszám, kártyaszám, banki jelszó. A `note` mező mellett figyelmeztetés: „Ne írj ide jelszót vagy számlaszámot." |
| Megőrzés | `notifications` 90 nap, `news_items` lejárat+60 nap, letiltott push-feliratkozás 30 nap. |
| Sütik | Csak **szükséges** sütik (session, `NEXT_LOCALE`, `br_remember`, téma) → nincs analitikai/hirdetési süti, ezért külön „cookie banner" nem kötelező, de a `/privacy` felsorolja őket. **Nincs** harmadik fél követő (GA, Pixel) v1-ben. |
| Adatfeldolgozók | Supabase (EU, Stockholm), Vercel, e-mail szolgáltató → a `/privacy`-ben felsorolva. |
| Naplózás | Edge Function log: **nincs** e-mail cím/név/összeg a logban (csak azonosítók). |

### 9.5 A „nem bank" figyelmeztetés (H10)

Látható helyen (login alja, Profil → Névjegy, Tippek oldal): *„A Bank Reminder nem bank és nem pénzügyi tanácsadó. Nem fér hozzá a bankszámládhoz; csak azt tudja, amit te megadsz. A tippek becslések."* (HU/EN)

### 9.6 Fenyegetésmodell (rövid)

| Veszély | Ellenintézkedés | Felelős |
|---|---|---|
| IDOR / más adata | RLS + `user_id` default `auth.uid()` + pgTAP „két felhasználó" tesztek (**A-14**) | A |
| XSS (hírek, jegyzet) | Minden szöveg **szövegként** renderelődik (nincs `dangerouslySetInnerHTML`); RSS-ből HTML-tisztítás szerveren; CSP | A+B |
| CSRF | Server Actions (beépített origin-ellenőrzés), `SameSite=Lax` süti; `/api/*` mutáló route-ok `Origin` ellenőrzéssel | B |
| Open redirect | `next` paraméter: csak `/`-rel kezdődő, `//`-t és sémát tartalmazó nem (`safeNext()`, §10.7) | B |
| Fiók-felderítés | Minden auth-visszajelzés általános (nem árulja el, létezik-e az e-mail) | B |
| Brute force / spam | Supabase beépített rate limit + opcionális **Cloudflare Turnstile** a signup/login/forgot űrlapokon (Dashboard → Auth → Attack Protection) | B+gazda |
| SSRF | Push `endpoint` host-allowlist (§8.3); RSS: csak a `news_sources` táblában, admin által felvett URL | A |
| Push-visszaélés | Max. **10** aktív eszköz/felhasználó; feliratkozás rate limit | A |
| Feltöltés | 2 MB, mime allowlist + **magic byte**; kliens WebP-re méretez; szerver újraellenőriz | B |
| Cron végpont | `x-cron-secret` fejléc, **konstans idejű** összehasonlítás; `verify_jwt=false` csak ezeken | A |
| Titok-szivárgás | H3; `gitleaks`-szerű pre-commit ellenőrzés (**A-01**) | A |
| ICS-token szivárgás | Forgatható (`rotate_ics_token()`), a feed csak minimális adatot ad | A+B |
| Függőségek | `npm audit` CI-ban; `npm ci`; lockfile commitolva | B |
| Biztonsági fejlécek | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'` (`next.config.ts` headers) | B |

---

## 10. Auth és session

### 10.1 Útvonalak

| Útvonal | Cél | Hozzáférés |
|---|---|---|
| `/login` | Belépés (fül: *Belépés \| Regisztráció*) | publikus; bejelentkezve → `/dashboard` |
| `/signup` | Regisztráció | publikus |
| `/check-email` | „Nézd meg a leveled" + újraküldés | publikus |
| `/forgot-password` | E-mail megadása jelszó-visszaállításhoz | publikus |
| `/auth/confirm` | **Közbenső oldal**: `token_hash` + `type` → gombnyomásra `verifyOtp` | publikus |
| `/reset-password` | Új jelszó megadása | csak érvényes (recovery) session-nel |
| `/auth/callback` | PKCE `code` csere (jövőbeli OAuth-hoz fenntartva) | publikus |
| `/(app)/*` | A teljes alkalmazás | **csak bejelentkezve**, különben `/login?next=…` |

### 10.2 Regisztráció (F-01)

Mezők: **név** (megjelenítési, 1–60), **e-mail**, **jelszó** (≥ 8, legalább 1 betű + 1 szám; erősség-jelző; mutat/elrejt gomb), **nyelv** (a böngészőből előtöltve), **elfogadás** jelölőnégyzet.

```ts
// app/(auth)/signup/actions.ts
'use server'
export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { email, password, displayName, locale } = parsed.data;

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL!;
  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { display_name: displayName, locale },          // → {{ .Data.display_name }} / {{ .Data.locale }} az e-mailben
      emailRedirectTo: `${origin}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) return mapAuthError(error);                    // §10.8
  redirect(`/check-email?type=signup&e=${encodeURIComponent(email)}`);   // létező e-mailnél is UGYANEZ (nem árulunk el semmit)
}
```

### 10.3 Belépés + **„Maradjak bejelentkezve"** (F-02) 🔴

**Cél:** bepipálva → a session **tartósan** megmarad (böngésző/PWA újraindítás után is); kipipálva → **session-süti** (böngésző bezárásakor eltűnik).

**Megoldás:** a Supabase-session sütik `maxAge`-jét a kód vezérli egy `br_remember` jelző süti alapján.

```ts
// lib/auth/persist.ts
export const REMEMBER_COOKIE = 'br_remember';              // '1' | '0' ; hiányzó = '1'
const FOUR_HUNDRED_DAYS = 60 * 60 * 24 * 400;

export function applyPersistence(options: CookieOptions, remember: boolean): CookieOptions {
  if (options.maxAge === 0) return options;                // törlés: érintetlen
  if (remember) return { ...options, maxAge: options.maxAge ?? FOUR_HUNDRED_DAYS };
  const { maxAge: _m, expires: _e, ...rest } = options;    // maxAge/expires nélkül = session-süti
  return rest;
}
```

- `utils/supabase/server.ts` és `middleware.ts` `setAll`-ja: `cookieStore.set(name, value, applyPersistence(options, remember))`. A `remember` jön a `createClient(cookieStore, { remember })` paraméterből (belépéskor *explicit*), különben a `br_remember` sütiből.
- A `signIn` Server Action **a `signInWithPassword` előtt** állítja be a `br_remember` sütit, és explicit átadja a `remember`-t (nem támaszkodik arra, hogy a `cookies().get` azonnal látja a frissen írt értéket).
- `utils/supabase/client.ts` (böngésző): a `createBrowserClient(url, key, { cookieOptions })` — a `cookieOptions.maxAge` a `br_remember` jelzőből (`document.cookie`).
- 🔴 **Telepített PWA-ban (`display-mode: standalone`) a „Maradjak bejelentkezve" jelölőnégyzet elrejtődik, és az érték mindig `1`** (a telepített app session-sütije nem megbízhatóan tűnik el „bezáráskor", és a felhasználó azt várja, hogy az app bejelentkezve marad).
- Guard-teszt (**B-09**): `applyPersistence` 4 esete (remember igen/nem × törlés igen/nem).
- Kijelentkezés: `supabase.auth.signOut()` (`scope: 'local'` alap; a Profilban külön: „Kijelentkezés minden eszközről" = `scope: 'global'`), `br_remember` törlése, push-feliratkozás **marad** (az eszköz értesítést kap, de kijelentkezve az app nem mutat adatot — ezért van a **Diszkrét mód**, ami elrejti a nevet/összeget a zárolt képernyőn: lásd §12.3).

### 10.4 Elfelejtett jelszó (F-02)

1. `/forgot-password`: e-mail → `supabase.auth.resetPasswordForEmail(email)` → **mindig** a „Ha létezik ilyen fiók, küldtünk levelet" üzenet.
2. A levél gombja: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` (§11).
3. `/auth/confirm` közbenső oldal → „Folytatás" gomb → `verifyOtp({ type:'recovery', token_hash })` → recovery-session → `/reset-password`.
4. `/reset-password`: új jelszó ×2 → `supabase.auth.updateUser({ password })` → siker → `/dashboard`. Opció: „Kijelentkezés minden más eszközről" (`signOut({ scope: 'others' })`).
5. Lejárt/felhasznált link → `/forgot-password?error=otp_expired` + magyarázat.

### 10.5 Supabase Dashboard — kötelező beállítások (**A-04**, a gazda jóváhagyásával)

> Az Auth-beállítások Dashboardon élnek, nem migrációban → ezt **checklistként** kell kipipálni és a `docs/STATUS.md`-ben rögzíteni.

| Beállítás (Authentication →) | Érték |
|---|---|
| URL Configuration → **Site URL** | az éles domain (pl. `https://<app>.vercel.app`; később saját domain) |
| URL Configuration → **Redirect URLs** | `http://localhost:3000/**`, az éles domain `/**`, Vercel preview: `https://*-<team>.vercel.app/**` |
| Providers → Email | **Enable** · **Confirm email: ON** · Secure email change: ON · Secure password change: ON |
| Password | **Minimum length 8**; „Required characters": betűk + számok |
| SMTP Settings | **Egyéni SMTP** *(az alap SMTP csak csapattagoknak küld, 2 levél/óra — éles regisztrációhoz használhatatlan)*; feladó: `no-reply@<domain>`, név: `Bank Reminder`; SPF/DKIM/DMARC beállítva |
| Rate Limits | Levélküldés/óra: az SMTP szolgáltatóhoz igazítva (alap egyéni SMTP-nél 30/óra → emelés) |
| Email Templates | A **§11** sablonjai: Confirm signup, Reset password, Change email, Reauthentication, Magic link, Invite; **Security notifications**: *Password changed*, *Email address changed* → BE |
| Attack Protection | CAPTCHA (Turnstile) — **SHOULD** éles indulás előtt |
| Sessions | (Free-n nincs time-box/inaktivitási limit) |
| Sign-ups | Enabled |

### 10.6 Kódvázlatok (B tulajdona)

**`utils/supabase/server.ts`** (a gazda útmutatójából, kiegészítve a tartós/nem tartós sessionnel):

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { applyPersistence, REMEMBER_COOKIE } from '@/lib/auth/persist';

export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  opts: { remember?: boolean } = {},
) =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          const remember = opts.remember ?? cookieStore.get(REMEMBER_COOKIE)?.value !== '0';
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyPersistence(options, remember)));
          } catch { /* Server Component-ből hívva: a proxy.ts frissíti a sessiont */ }
        },
      },
    },
  );
```

**`proxy.ts`** (Next 16; a régi `middleware.ts` neve) + **`utils/supabase/middleware.ts`** `updateSession()`:

```ts
// proxy.ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
export async function proxy(request: NextRequest) { return updateSession(request); }
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
```

`updateSession` szabályai:
1. `createServerClient(...)` a *request* sütikkel; **a `createServerClient` és a `getClaims()` között ne legyen más kód** (különben a session szinkron elromolhat).
2. `const { data } = await supabase.auth.getClaims()` (gyors, JWKS-sel ellenőrzi). Érzékeny művelethez a szerver oldalon `auth.getUser()`.
3. Nincs claims és az útvonal nem publikus → HTML-útvonalon `redirect /login?next=<útvonal>`, **`/api/*`-on `401` JSON** (nem átirányítás).
4. Van claims és `/login`/`/signup` → `/dashboard`.
5. Publikus lista: `/login /signup /check-email /forgot-password /reset-password /auth/* /install /privacy /terms /offline /api/health /api/ics/*`.
6. Hitelesített válaszokra: `Cache-Control: private, no-store`.
7. A visszaadott `supabaseResponse` objektumot **módosítatlanul** add vissza (a sütik rajta vannak).

### 10.7 `safeNext()` (open redirect ellen)

```ts
export function safeNext(next: string | null | undefined, fallback = '/dashboard') {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  try { const u = new URL(next, 'http://x'); return u.origin === 'http://x' ? u.pathname + u.search : fallback; }
  catch { return fallback; }
}
```
Guard-teszt (**B-09**): `//evil.com`, `/\evil`, `https://evil`, `javascript:` → mind `fallback`.

### 10.8 Auth-hibák leképezése (egy helyen: `lib/auth/errors.ts`)

| Supabase hiba/kód | UI üzenet kulcs (HU/EN a `locales`-ban) | Megjegyzés |
|---|---|---|
| `invalid_credentials` | `auth.error.invalidCredentials` — „Hibás e-mail vagy jelszó" | általános |
| `email_not_confirmed` | `auth.error.emailNotConfirmed` + „Újraküldés" gomb | |
| `weak_password` | `auth.error.weakPassword` | |
| `user_already_exists` / (obfuszkált siker) | nincs külön — a `/check-email` oldal általános szövege | **nem** árulja el |
| `over_email_send_rate_limit` | `auth.error.tooManyEmails` — „Kicsit várj, mielőtt újra kérnél levelet" | + 60 mp visszaszámlálás |
| `over_request_rate_limit` | `auth.error.tooManyRequests` | |
| `otp_expired` / `bad_otp` | `auth.error.linkExpired` + új link kérése | |
| `same_password` | `auth.error.samePassword` | |
| ismeretlen | `common.error.generic` + `console.error` (szerveren, PII nélkül) | |

---

## 11. E-mail sablonok (Supabase Auth)

> **Feladat (A-05):** a sablonokat a `supabase/email-templates/*.html` fájlokba kell tenni, majd a gazda/AI-A a Dashboardon (Authentication → Email Templates) beilleszti. A sablon **Go template**; a regisztrációkor átadott metaadat elérhető: `{{ .Data.display_name }}`, `{{ .Data.locale }}`.
>
> **Elérhető változók:** `{{ .ConfirmationURL }}`, `{{ .Token }}` (6 jegyű OTP), `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Data }}`.
>
> **Linkformátum:** SSR-hez *nem* a `{{ .ConfirmationURL }}`-t használjuk, hanem a saját végpontunkat a `token_hash`-sel (a `/auth/confirm` közbenső oldal *gombnyomásra* hív `verifyOtp`-t → a levélszkennerek előbetöltése nem „égeti el" az egyszer használatos linket).
>
> **Tárgysor:** az A-05 feladata megállapítani, hogy a *Subject* mező is sablonként értelmeződik-e. Ha **igen**: használd a személyre szabott tárgyat; ha **nem**: használd a *fix kétnyelvű* tárgyat (alább mindkettő).

### 11.1 Tárgysorok

| Sablon | Személyre szabott (ha támogatott) | Fix, kétnyelvű (tartalék) |
|---|---|---|
| Confirm signup | `{{ if eq .Data.locale "en" }}Welcome to Bank Reminder, {{ .Data.display_name }} — confirm your email{{ else }}Üdv a Bank Reminderben, {{ .Data.display_name }}! Erősítsd meg az e-mail címed{{ end }}` | `Üdv a Bank Reminderben! Erősítsd meg az e-mailed · Confirm your email` |
| Reset password | `{{ if eq .Data.locale "en" }}Reset your Bank Reminder password{{ else }}Jelszó-visszaállítás — Bank Reminder{{ end }}` | `Jelszó-visszaállítás · Reset your password` |
| Change email | — | `E-mail cím módosítása · Confirm your new email` |
| Reauthentication | — | `Megerősítő kód · Your verification code` |
| Password changed (értesítés) | — | `A jelszavad megváltozott · Your password was changed` |

### 11.2 `confirm-signup.html` — **teljes** sablon (HU/EN, személyre szabott)

```html
<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>Bank Reminder</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F8;">
  <!-- előnézeti szöveg (preheader) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {{ if eq .Data.locale "en" }}One click and your bills are in one place.{{ else }}Egy kattintás, és minden számlád egy helyen lesz.{{ end }}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#FFFFFF;border-radius:20px;border:1px solid #E7EAEE;overflow:hidden;">

        <!-- fejléc -->
        <tr><td style="padding:28px 32px 0 32px;font-family:Inter,Segoe UI,Arial,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#0B7F70;border-radius:10px;text-align:center;
                       font-size:20px;line-height:36px;color:#FFFFFF;">🔔</td>
            <td style="padding-left:10px;font-size:18px;font-weight:700;color:#0F1720;">Bank Reminder</td>
          </tr></table>
        </td></tr>

        <!-- tartalom -->
        <tr><td style="padding:24px 32px 8px 32px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0F1720;">
        {{ if eq .Data.locale "en" }}
          <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;">
            Hi{{ if .Data.display_name }} {{ .Data.display_name }}{{ end }}! 👋
          </h1>
          <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#334155;">
            Thanks for joining <strong>Bank Reminder</strong>. Confirm your email address
            (<strong>{{ .Email }}</strong>) with one click and you're in.
          </p>
        {{ else }}
          <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;">
            Szia{{ if .Data.display_name }} {{ .Data.display_name }}{{ end }}! 👋
          </h1>
          <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#334155;">
            Köszönjük, hogy csatlakoztál a <strong>Bank Reminderhez</strong>. Egyetlen kattintással
            megerősítjük az e-mail címedet (<strong>{{ .Email }}</strong>), és már használhatod is.
          </p>
        {{ end }}
        </td></tr>

        <!-- gomb -->
        <tr><td align="left" style="padding:8px 32px 8px 32px;font-family:Inter,Segoe UI,Arial,sans-serif;">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding"
             style="display:inline-block;background:#0B7F70;color:#FFFFFF;text-decoration:none;font-weight:600;
                    font-size:16px;padding:14px 28px;border-radius:12px;">
            {{ if eq .Data.locale "en" }}Confirm my account{{ else }}Fiók megerősítése{{ end }}
          </a>
        </td></tr>

        <!-- mit fogsz tudni -->
        <tr><td style="padding:20px 32px 4px 32px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#334155;font-size:15px;line-height:1.7;">
        {{ if eq .Data.locale "en" }}
          <p style="margin:0 0 6px 0;font-weight:600;color:#0F1720;">What you'll be able to do:</p>
          <p style="margin:0;">📅 Add every bill and subscription once — Netflix, rent, loans, insurance.<br>
             🔔 Get a reminder in time — on your phone, tablet and computer.<br>
             📊 See where your money goes and where you could save.</p>
        {{ else }}
          <p style="margin:0 0 6px 0;font-weight:600;color:#0F1720;">Ezt fogod tudni:</p>
          <p style="margin:0;">📅 Egyszer felveszed a számláidat és előfizetéseidet — Netflix, rezsi, hitel, biztosítás.<br>
             🔔 Időben szólunk — telefonon, tableten és számítógépen is.<br>
             📊 Látod, hová megy a pénzed, és hol spórolhatsz.</p>
        {{ end }}
        </td></tr>

        <!-- tartalék link + biztonsági megjegyzés -->
        <tr><td style="padding:20px 32px 28px 32px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#64748B;font-size:13px;line-height:1.6;">
        {{ if eq .Data.locale "en" }}
          <p style="margin:0 0 8px 0;">Button not working? Copy this link into your browser:<br>
            <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding"
               style="color:#0B7F70;word-break:break-all;">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup</a></p>
          <p style="margin:0 0 8px 0;">The link is valid for 1 hour. Didn't sign up? Just ignore this email — the account won't be activated.</p>
          <p style="margin:0;">Bank Reminder is not a bank and never asks for your banking passwords.</p>
        {{ else }}
          <p style="margin:0 0 8px 0;">Nem működik a gomb? Másold be ezt a linket a böngészőbe:<br>
            <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding"
               style="color:#0B7F70;word-break:break-all;">{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup</a></p>
          <p style="margin:0 0 8px 0;">A link 1 óráig érvényes. Nem te regisztráltál? Hagyd figyelmen kívül ezt a levelet — a fiók nem lesz aktiválva.</p>
          <p style="margin:0;">A Bank Reminder nem bank, és soha nem kér tőled banki jelszót.</p>
        {{ end }}
        </td></tr>
      </table>

      <p style="margin:16px 0 0 0;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;color:#94A3B8;">
        {{ if eq .Data.locale "en" }}This is an automated message — please don't reply.{{ else }}Ez egy automatikus üzenet — kérjük, ne válaszolj rá.{{ end }}
      </p>
    </td></tr>
  </table>
</body>
</html>
```

> **Megjegyzés AI-A-nak:** az `🔔`/emoji megjelenítése levelezőnként eltér → a logó-négyzet végleges változatban legyen **kép** (a gazda logója, `https://<domain>/icons/email-logo.png`), az emoji csak tartalék. A sablont ellenőrizd: Gmail (web+app), Outlook, Apple Mail, mobil + sötét mód (a `color-scheme: light only` miatt a legtöbb kliens nem invertálja).

### 11.3 `recovery.html` — jelszó-visszaállítás (ugyanaz a keret, más tartalom)

A 11.2 *keretét* (fejléc, kártya, gomb, lábléc) használd; a tartalom:

| | HU | EN |
|---|---|---|
| Cím | `Szia{{ if .Data.display_name }} {{ .Data.display_name }}{{ end }}!` | `Hi{{ if .Data.display_name }} {{ .Data.display_name }}{{ end }}!` |
| Szöveg | „Jelszó-visszaállítást kértek a(z) **{{ .Email }}** fiókhoz. Kattints a gombra, és adj meg egy új jelszót." | "We got a request to reset the password for **{{ .Email }}**. Click the button to choose a new one." |
| Gomb | **Új jelszó beállítása** | **Set a new password** |
| Link | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` | ugyanaz |
| Lábléc | „A link 1 óráig érvényes. **Nem te kérted?** Ne aggódj, a jelszavad nem változott — hagyd figyelmen kívül a levelet. Ha többször kapsz ilyet, javasoljuk a jelszavad megváltoztatását." | "The link is valid for 1 hour. **Didn't ask for this?** Your password hasn't changed — just ignore this email." |

### 11.4 A többi sablon (rövid tartalom, ugyanazzal a kerettel)

| Sablon | Tartalom (HU / EN) | Link/változó |
|---|---|---|
| **Change email** | „Megerősítenéd az új e-mail címedet (**{{ .NewEmail }}**)?" / "Confirm your new email address (**{{ .NewEmail }}**)?" · gomb: *E-mail módosítása* | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/profile` |
| **Reauthentication** | „A művelet megerősítő kódja:" / "Your verification code:" + nagy betűkkel **`{{ .Token }}`** · „10 percig érvényes" (a tényleges érvényesség a Dashboard OTP-lejáratától függ — ellenőrizd, és ahhoz igazítsd a szöveget) | `{{ .Token }}` |
| **Magic link** | Nem használjuk (v1) — de a Dashboard kitöltést kér: egyszerű belépő-link sablon, ugyanazzal a kerettel | `…&type=magiclink` |
| **Invite user** | Nem használjuk — rövid, semleges szöveg | `…&type=invite` |
| **Password changed** (biztonsági értesítés) | „A jelszavad megváltozott. Ha nem te voltál, **azonnal** állítsd vissza: [link a /forgot-password-ra]." / "Your password was changed. If this wasn't you, reset it right away." | `{{ .SiteURL }}/forgot-password` |
| **Email changed** (értesítés) | Értesítés a *régi* címre: „Az e-mail címed megváltozott: `{{ .OldEmail }}` → `{{ .Email }}`." | `{{ .OldEmail }}` |

### 11.5 Tesztelés (A-05 elfogadási kritérium)

1. Új regisztráció **HU** nyelvvel → HU levél, a név megjelenik („Szia Szabi!").
2. Új regisztráció **EN** nyelvvel → EN levél.
3. Név nélküli (üres `display_name`) → „Szia!" (nincs üres szóköz/`<no value>` felirat).
4. A gomb → `/auth/confirm` közbenső oldal → „Megerősítem" → bejelentkezve az `/onboarding`-on.
5. Recovery levél végigvíve.
6. A levél tárgya nem tartalmaz nyers `{{ … }}` szöveget.
7. Kinézet: Gmail web + Gmail mobil + Outlook + Apple Mail (képernyőkép a `docs/`-ba nem kell; a STATUS.md-be egy „✔ ellenőrizve" sor).

---

## 12. Értesítési rendszer

> **A gazda fő kérése:** telefonra *és* mindenhova (tablet, laptop, PC) értesítés menjen az emlékeztetőkről. Ez a rendszer legfontosabb része — ezért itt a legszigorúbbak az elfogadási kritériumok (§12.14).

### 12.1 Csatornák

| Csatorna | Mire jó | Alap | Megjegyzés |
|---|---|---|---|
| **Web Push** | Az elsődleges: minden eszközre, amin a felhasználó bekapcsolta | **be** (ha engedélyezte) | VAPID, RFC 8030/8291/8292; eszközönként 1 feliratkozás |
| **In-app** (értesítésközpont, 🔔) | Mindig megvan; push nélkül is látszik | mindig | Ugyanaz a `notifications` tábla, `channel='in_app'` |
| **E-mail** | Tartalék (pl. iOS-en nincs telepítve az app) | **ki** | Profilban és emlékeztetőnként kapcsolható |
| **ICS naptár-feed** | Biztos tartalék minden platformon | opcionális | §12.8 |
| **App-jelvény** | A telepített app ikonján a nyitott esedékesek száma | be | Badging API, §13.5 |

### 12.2 A csővezeték

```
[reminders] ──(trigger/RPC)──► ensure_occurrences ──► [occurrences]
                                                         │
          rebuild_notification_queue(reminder_id)  ◄─────┘
                         │   minden (esedékesség × offset × csatorna) → 1 sor
                         ▼
                  [notifications]  status='pending', scheduled_for, dedupe_key (UNIQUE)
                         ▲
   pg_cron */5: enqueue_extra_notifications()  → overdue / trial_end / digest sorok
                         │
   pg_cron * * * * *  ── pg_net ──►  Edge Function  send-notifications
                                          │ 1. claim_due_notifications(100)   (FOR UPDATE SKIP LOCKED)
                                          │ 2. globális/csatorna-kapcsoló ellenőrzés → ha ki: 'cancelled'
                                          │ 3. szöveg készítése a felhasználó nyelvén (§12.3)
                                          │ 4. push: minden aktív feliratkozásra (párhuzamosan, időkorláttal)
                                          │    e-mail: szolgáltató API
                                          ▼
                                   sent / failed(+backoff) / expired / cancelled
```

**Szabályok (🔴 mind tesztelendő):**

1. **Idempotens:** a `dedupe_key UNIQUE` + `insert … on conflict do nothing` → a sor-építés tetszőlegesen sokszor futhat.
2. **Időzóna-helyes:** `scheduled_for = ((due_date − offset) + remind_time) AT TIME ZONE profiles.timezone` (§8.4 vektorok).
3. **Elavult értesítés nem megy ki:** ha `scheduled_for` régebbi, mint **24 óra**, a claim-lépés `expired`-re állítja, **nem küldi el** (pl. leállás után ne jöjjön 3 napos „holnap esedékes").
4. **Kapcsolók a küldés pillanatában érvényesek:** `profiles.reminders_enabled = false` vagy `reminders.remind_enabled = false` vagy a csatorna-kapcsoló kikapcsolva → `cancelled`. (Így a felhasználó kapcsolója *azonnal* hat.)
5. **Kifizetve = nem küld:** `mark_paid` a függőben lévő sorokat `cancelled`-re állítja; a küldő *még egyszer ellenőrzi* az `occurrences.status`-t a küldés előtt.
6. **Újrapróbálás:** `failed` → `next_attempt_at = now() + 2^attempts perc`, max. **5** próba; utána véglegesen `failed`.
7. **Beragadt `sending`:** 5 percnél régebbi `claimed_at`-ú sor újra claim-elhető.
8. **Aznapra felvett emlékeztető:** ha `scheduled_for` már elmúlt, de ≤ 24 órája volt → azonnal (a következő percben) kimegy.
9. **Tesztelhetőség:** minden SQL függvény kap `p_now timestamptz default now()` paramétert → pgTAP fix „órával" futtathat.

**Mikor mit épít a sor-építő (`rebuild_notification_queue`):**

| Forrás | Sorok |
|---|---|
| minden `upcoming` esedékesség a következő 120 napban × minden `remind_offsets` elem | `kind='reminder'`, csatornák: `in_app` (mindig) + `push` (ha a profil és az emlékeztető engedi) + `email` (ha engedi) |
| `enqueue_extra_notifications()` — lejárt tétel | `kind='overdue'`: a lejárat **másnapján** `remind_time`-kor, majd +3 napra (max. 2 db), amíg `upcoming` |
| `trial_ends_on` | `kind='trial_end'`: a próba vége **előtti napon** `remind_time`-kor |
| heti digest | `kind='digest'`: vasárnap **18:00** helyi idő, ha `weekly_digest` és van legalább 1 tétel a következő 7 napban |

### 12.3 Szövegek (a küldő Edge Function szótára: `_shared/i18n.ts`, **HU/EN**)

A `notifications.payload` *adat*; a szöveg **küldéskor** készül a profil `locale`-ja szerint (nyelvváltás után a függő értesítések is új nyelven mennek ki). Számok/dátumok `Intl`-lel, a profil időzónájában.

| `kind` | HU cím · törzs | EN title · body |
|---|---|---|
| `reminder`, offset ≥ 2 | **{name} — {n} nap múlva esedékes** · {amount} · {dátum} | **{name} — due in {n} days** · {amount} · {date} |
| `reminder`, offset = 1 | **{name} — holnap esedékes** · {amount} · {dátum} | **{name} — due tomorrow** · {amount} · {date} |
| `reminder`, offset = 0 | **{name} — ma esedékes** · {amount} | **{name} — due today** · {amount} |
| `overdue` | **{name} — lejárt** · {dátum} óta várja a befizetést ({amount}). Kifizetted? | **{name} — overdue** · Was due {date} ({amount}). Paid it? |
| `trial_end` | **{name} — holnap lejár az ingyenes próba** · Ha nem kéred, mondd le még ma. | **{name} — free trial ends tomorrow** · Cancel today if you don't want it. |
| `digest` | **Következő 7 nap: {count} tétel, {total}** · {1.}, {2.}, {3.}… | **Next 7 days: {count} bills, {total}** · {1st}, {2nd}, {3rd}… |
| teszt | **Működik! 🎉** · Ez egy teszt-értesítés ({eszköz}). | **It works! 🎉** · This is a test notification ({device}). |

**Diszkrét mód** (`profiles.notify_hide_details = true`): minden `reminder`/`overdue` → cím **„Fizetés esedékes"** / **"A payment is due"**, törzs **„Nyisd meg az appot a részletekért."** / **"Open the app for details."** (nincs név, nincs összeg a zárolt képernyőn).

Gombok (ahol a platform támogatja): **Kifizettem** / **Paid** · **Holnap emlékeztess** / **Remind me tomorrow**.

### 12.4 Kliens: feliratkozás (B-feladat) 🔴

```ts
// lib/push-client.ts — a feliratkozás CSAK felhasználói gesztusból (gombnyomás) indulhat
export async function enablePush(): Promise<PushResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return { ok: false, reason: 'unsupported' };
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios_not_installed' };   // §12.9

  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  try {
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,                                    // iOS/Safari kötelező
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
  } catch {
    return { ok: false, reason: (await isBrave()) ? 'brave_push_service' : 'subscribe_failed' };
  }
  const saved = await savePushSubscription(sub.toJSON(), { platform: detectPlatform(), label: deviceLabel() }); // Server Action
  return saved.ok ? { ok: true } : { ok: false, reason: 'server_rejected' };
}
```

- A SW regisztrációja: `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })` az app-shell első betöltésekor (`components/push/sw-register.tsx`).
- A Profil → Értesítések szekció **eszközlistát** mutat (`push_subscriptions`: platform, címke, utolsó siker) „Eltávolítás" gombbal, és az **állapot-diagnosztikát** (§12.10).
- Kijelentkezéskor a feliratkozás **marad** (az eszköz továbbra is kap értesítést, de a push *csak a diszkrét/engedélyezett szöveget* tartalmazza). Ha a felhasználó azt szeretné, hogy kijelentkezéskor az eszköz feliratkozása törlődjön: a kijelentkezés-dialógus „Értesítések kikapcsolása ezen az eszközön" jelölőnégyzete (alapból **ki**).

### 12.5 Service worker (`public/sw.js`) — vázlat 🔴

```js
// SW_VERSION: 1   ← frissítéshez léptesd (a böngésző a bájtkülönbséget figyeli)
const SW_VERSION = 1;
const STATIC_CACHE = `br-static-v${SW_VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
  // nincs automatikus skipWaiting: új verziót csak a felhasználó jóváhagyásakor aktiválunk ('SKIP_WAITING' üzenet)
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== STATIC_CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// Cache-szabály: lásd §13.4 (hitelesített HTML-t SOHA nem cache-elünk)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                         // Supabase, push, képek: érintetlenül
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));  // csak offline-tartalék
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); return res;
    })));
  }
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch { d = { title: 'Bank Reminder', body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Bank Reminder', {   // MINDIG mutatunk értesítést (iOS/Safari követelmény)
      body: d.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: d.tag,                                                         // azonos tag = felülírja, nem halmozódik
      timestamp: d.ts || Date.now(),
      data: { url: d.url || '/dashboard', occId: d.occId, kind: d.kind },
      actions: (d.actions || []).slice(0, 2),                             // [{action:'paid', title:'Kifizettem'}, …]
    });
    if (typeof d.badge === 'number' && self.navigator.setAppBadge) { try { await self.navigator.setAppBadge(d.badge); } catch {} }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, occId } = event.notification.data || {};
  event.waitUntil((async () => {
    if (occId && (event.action === 'paid' || event.action === 'snooze')) {
      try {
        const res = await fetch(`/api/occurrences/${occId}/${event.action}`, {
          method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}',
        });
        if (res.ok) return;                                              // kész, nem nyitunk ablakot
      } catch {}
      // hiba (pl. lejárt session) → nyissuk meg az appot, hogy a felhasználó be tudja fejezni
    }
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = url || '/dashboard';
    for (const c of all) if ('focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(target); return; }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const { key } = await (await fetch('/api/push/vapid-public-key')).json();
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await fetch('/api/push/resubscribe', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: event.oldSubscription && event.oldSubscription.endpoint }),
    });
  })());
});
```

> A fenti **vázlat**, nem végleges kód: a B-feladat a pontos kulcsformátumot (`applicationServerKey` base64url → `Uint8Array`), hibakezelést és tesztet hozzáteszi. A **cache-szabály** (nincs hitelesített HTML) **kötelező**.

### 12.6 A push-üzenet formátuma (szerződés)

```jsonc
// Edge Function → push szolgáltató (aes128gcm-mel titkosítva, ≤ 4 KB)
{
  "v": 1,
  "kind": "reminder",                       // reminder | overdue | trial_end | digest | test
  "title": "Netflix — holnap esedékes",     // a felhasználó nyelvén (§12.3)
  "body": "2 300 Ft · nov. 10.",
  "url": "/reminders/<reminderId>?occ=<occId>",   // deep link (relatív!)
  "tag": "rem-<occIdRövid>-o1",             // ≤ 32 karakter; ugyanaz → csere, nem halmozódás
  "occId": "<uuid>",
  "badge": 3,                               // a nyitott/lejárt esedékesek száma (app-jelvényhez)
  "actions": [ { "action": "paid", "title": "Kifizettem" }, { "action": "snooze", "title": "Holnap emlékeztess" } ],
  "ts": 1794556800000,
  "lang": "hu"
}
```
Push-fejlécek: `TTL: 86400` (24 óra, egyezik az „elavul" szabállyal) · `Urgency: normal` · `Topic: <tag>` (≤ 32 b64url karakter; a push szolgáltató összevonja az azonos témájú, még ki nem kézbesített üzeneteket).

### 12.7 Heti digest (F-17)

Vasárnap 18:00 (helyi idő). Tartalom: a következő 7 nap tételei (max. 3 név + „…és még N"), összeg alap-pénznemben; link: `/calendar`. Kikapcsolható (Profil → Értesítések → „Heti összefoglaló"). E-mail csatornán is mehet (ha engedélyezve).

### 12.8 ICS naptár-feed (F-16)

- URL: `https://<domain>/api/ics/<token>.ics` (+ `webcal://` link a „Hozzáadás a naptárhoz" gombon). A token a `profiles.ics_token`.
- Tartalom: az **aktív emlékeztetők** esedékességei **−30 naptól +365 napig**. `VEVENT` teljes napos (`DTSTART;VALUE=DATE`), `SUMMARY:Netflix — 2 300 Ft`, `UID:occ-<id>@bankreminder`, `DESCRIPTION` (megjegyzés nélkül — érzékeny adat minimalizálása), és `VALARM` az **első `remind_offsets` elem** szerint (`TRIGGER:-P1D`).
- RFC 5545: CRLF sorvégek, 75 oktettes sortörés, speciális karakterek escape-elése (`,` `;` `\` újsor), `PRODID`, `X-WR-CALNAME:Bank Reminder`, `X-PUBLISHED-TTL:PT1H`.
- `Cache-Control: private, max-age=900`. Token forgatása: Profil → „Új naptár-link" (`rotate_ics_token()`); a régi azonnal érvénytelen.
- A feed **csak olvasható**, és a naptár-app tipikusan órákig cache-eli → a felületen jelezzük („a naptár néhány óra késéssel frissülhet").

### 12.9 Platform-mátrix (🔴 ezt a UI is használja a tanácsadáshoz)

| Platform / böngésző | Web Push | Feltétel / megjegyzés |
|---|---|---|
| **Android** — Chrome, Edge, Samsung Internet, Firefox | ✔ | Böngészőből *és* telepítve is. |
| **Windows / macOS / Linux** — Chrome, Edge, Firefox | ✔ | A böngésző-folyamatnak futnia kell (Chrome/Edge alapból háttérben fut). **Telepített PWA** (külön ablak) javasolt. |
| **macOS Safari** (macOS 13+) | ✔ | Standard Web Push; a felhasználói gesztus kötelező. |
| **iPhone / iPad** (iOS/iPadOS **16.4+**) | ✔ **csak telepített** | **Csak akkor**, ha az app a **Kezdőképernyőre** van téve; Safari-fülben **nincs** push. Az engedélykérés gesztusból. A *művelet-gombok* iOS-en nem biztos, hogy megjelennek → a koppintás az appot nyitja meg (a SW-nek ez az alapviselkedése). |
| **Brave** (asztali + Android) | ⚠ | Alapból **nem működik**, amíg a *Beállítások → Adatvédelem és biztonság → „Use Google services for push messaging"* be nincs kapcsolva (a feliratkozás `AbortError: Registration failed - push service error`-ral bukik). Közösségi bejelentések alapján; az UI jelezze (lásd alább). |
| **Beágyazott böngészők** (Facebook/Instagram/Messenger webview) | ✘ | „Nyisd meg a böngészőben" üzenet. |
| Firefox asztali | ✔ push · ✘ PWA-telepítés | Telepítés helyett marad a böngésző-lap. |

**UI-viselkedés a hibákra** (`PushResult.reason` → üzenet + teendő):

| `reason` | Üzenet (HU) | Teendő-gomb |
|---|---|---|
| `unsupported` | „Ez a böngésző nem támogatja az értesítéseket." | „Próbáld Chrome-ban/Edge-ben/Safariban" + naptár-feed ajánlása |
| `ios_not_installed` | „iPhone-on az értesítéshez először add hozzá az appot a Kezdőképernyőhöz." | **iOS-telepítési útmutató** megnyitása (§13.3) |
| `denied` | „Az értesítések le vannak tiltva ennél az oldalnál." | Platform-specifikus lépések (a böngésző zár-ikon → Értesítések → Engedélyez) |
| `dismissed` | „Nem engedélyezted — bármikor bekapcsolhatod." | „Újra" gomb |
| `brave_push_service` | „A Brave alapból tiltja a push-szolgáltatást. Kapcsold be: Beállítások → Adatvédelem és biztonság → *Use Google services for push messaging*, indítsd újra a Brave-et, majd próbáld újra." | Másolható `brave://settings/privacy` szöveg |
| `subscribe_failed` | „Nem sikerült a feliratkozás. Próbáld újra, vagy használd a naptár-feedet." | „Újra" + diagnosztika |
| `server_rejected` | „A szerver nem fogadta el az eszközt (túl sok eszköz?)." | Eszközlista megnyitása |

### 12.10 Értesítés-diagnosztika (Profil → Értesítések)

Soronként ✔/✘/⚠ (ikon **és** szöveg): HTTPS · Service worker regisztrálva · Telepítve (standalone) · Engedély (`granted`) · Feliratkozás létezik a böngészőben · A szerver ismeri (`push_subscriptions`) · Utolsó sikeres kézbesítés (`last_success_at`) · Globális emlékeztető-kapcsoló · **[Teszt-értesítés küldése]** (→ Edge Function `send-test-push`, max. 3/perc). A teszt a *tényleges* útvonalat járja be (szerver → push szolgáltató → SW), nem csak a helyi `showNotification`-t.

### 12.11 Hibakezelés a küldőben

| Válasz a push szolgáltatótól | Teendő |
|---|---|
| `201` | `last_success_at = now()`, `failed_count = 0` |
| `404` / `410` | az `endpoint` halott → `disabled_at = now()` |
| `429` / `5xx` / időtúllépés | `failed` + backoff (a *sor* újrapróbálása; a feliratkozást nem tiltjuk le) |
| `401` / `403` (VAPID-hiba) | **riasztás** a logban (kulcs-eltérés?) — a sor `failed`, nem próbálkozunk vég nélkül |
| `failed_count >= 5` egymás után | `disabled_at = now()` |

### 12.12 E-mail csatorna

Az emlékeztető-levél rövid és kétnyelvű (a profil nyelvén): cím = a push-cím, törzs = összeg + dátum + gomb „Megnyitás az appban" (deep link). `List-Unsubscribe` fejléc → `/profile?section=notifications`. Küldő szolgáltató: ugyanaz, mint az Auth-SMTP (§26-Q2). Nem küld, ha a felhasználó kikapcsolta; naponta max. **1 összevont** levél/felhasználó (több esedékesség = egy levél).

### 12.13 In-app értesítésközpont

Fejléc 🔔 + olvasatlan-számláló; `/notifications` oldal: napok szerint csoportosítva, olvasott/olvasatlan, „Mind olvasottnak jelölése", koppintás → deep link. Frissítés: oldalbetöltéskor + `visibilitychange` + push-esemény (a SW `postMessage`-t küld a nyitott ablaknak). Realtime-előfizetés **nem** v1.

### 12.14 Elfogadási kritériumok (az értesítési rendszerre)

1. A **J3** példa (Netflix, havi 10., 1 nappal előtte, 09:00) → pontosan a §8.4 vektorai szerinti `scheduled_for` sorok jönnek létre.
2. Egy valós **Android** telefonon, egy **iPhone-on (telepítve)** és egy **Windows/Chrome** (vagy Edge) böngészőben a teszt-értesítés megérkezik; a *ténylegesen ütemezett* értesítés is (a sor `scheduled_for`-ját 2 percre állítva).
3. „Kifizettem" → a függő értesítések `cancelled`; ismételt futtatás nem küld.
4. Globális kapcsoló ki → semmi nem megy ki (a már sorban lévők sem).
5. 25 órával elmaradt sor → `expired`, nem megy ki.
6. Halott `endpoint` (410) → `disabled_at` beállítva, a többi eszközre kimegy.
7. A küldő kétszer is lefuthat ugyanarra a sorra → **egy** értesítés (claim + dedupe).
8. Diszkrét mód: a payload-ban nincs név/összeg.
9. Nyelvváltás (HU→EN) után a *még ki nem ment* értesítések angolul mennek.
10. pgTAP: DST-vektorok (§8.4) zöldek.

---

## 13. PWA és a „Download" gomb

> **Cél (a gazda szavaival):** egy **„Download"** gomb, ami lényegében letölti az appot **telefonra / laptopra / iPadre / tabletre / PC-re**, és mindenhol értesít. A webes technológia erre a **PWA-telepítés** — nincs app-store, nincs külön build.

### 13.1 Manifest (`app/manifest.ts`)

```ts
import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Bank Reminder',
    short_name: 'Reminder',
    description: 'Számla- és előfizetés-emlékeztetők, költségkövetés, spórolási tippek.',
    lang: 'hu',
    dir: 'ltr',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#FFFFFF',
    theme_color: '#0B7F70',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Új emlékeztető', short_name: 'Új', url: '/reminders/new?source=shortcut', icons: [{ src: '/icons/shortcut-add.png', sizes: '96x96' }] },
      { name: 'Következő esedékesek', short_name: 'Esedékes', url: '/reminders?source=shortcut' },
      { name: 'Analitika', short_name: 'Analitika', url: '/analytics?source=shortcut' },
    ],
    screenshots: [ /* B-26: 2 db keskeny (mobil) + 1 széles (asztali) a Chrome „gazdag telepítő" ablakához */ ],
  };
}
```

> A manifest nyelve statikus; a *név* nem lokalizálható futásidőben — ez rendben van (a márkanév). A `lang`-ot `hu`-ra állítjuk.

### 13.2 Ikonok és `<head>`

| Fájl | Méret | Megjegyzés |
|---|---|---|
| `icons/icon-192.png`, `icon-512.png` | 192, 512 | `purpose: any` |
| `icons/maskable-192.png`, `maskable-512.png` | 192, 512 | **safe zone**: a logó a középső 80%-on belül; teli háttér |
| `icons/apple-touch-icon.png` (+167, 152) | 180 (167, 152) | **átlátszatlan háttér** (iOS feketére festi az átlátszóságot) |
| `icons/badge-96.png` | 96 | **fehér, átlátszó** háttérű monokróm jel (Android státuszsor) |
| `favicon.ico` / `icon.svg` | — | |

- Egyetlen forrás: `assets/logo.svg` → `npm run gen:icons` (sharp) generálja az összeset. A logót a gazda adja; addig ideiglenes (harang + pipa) jel.
- `<head>`: `<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">` + `<meta name="theme-color" content="#0F1216" media="(prefers-color-scheme: dark)">`; `apple-mobile-web-app-capable: yes`; `apple-mobile-web-app-status-bar-style: default`; `viewport-fit=cover` + CSS `env(safe-area-inset-*)` a hornyos kijelzőkhöz.

### 13.3 A „Download" gomb (`components/install/install-button.tsx`) 🔴

**Hol jelenik meg:** (1) a `/login` oldal alján („Alkalmazás letöltése"), (2) a fejlécben/profilban, (3) a dashboardon egy elvethető kártyaként az első 3 látogatás után, (4) a **publikus `/install` oldalon** (QR-kóddal — asztali gépről a telefonra: „olvasd be, és nyisd meg a telefonodon").

**Állapotgép:**

| Állapot | Felismerés | Mit mutat |
|---|---|---|
| `installed` | `matchMedia('(display-mode: standalone)')` vagy `navigator.standalone` | „Telepítve ✔" + közvetlen link az értesítés-beállításhoz |
| `promptable` | `beforeinstallprompt` esemény megérkezett (Chromium: Android, Windows, macOS, Linux, ChromeOS) | **„Letöltés"** gomb → `prompt()` → `userChoice`; elmentett `deferredPrompt` |
| `ios` | iOS/iPadOS Safari, nincs standalone (iPadOS 13+ „MacIntel + touch" felismerés!) | **„Letöltés"** gomb → modális **lépésről lépésre** útmutató: ① koppints a **Megosztás** ikonra ② **Kezdőképernyőhöz adás** ③ **Hozzáadás** — képernyőképes/ikonos illusztrációval; + megjegyzés: „Az értesítésekhez erre szükség van." |
| `ios-other-browser` | iOS Chrome/Firefox/Edge (régi iOS-eken nem telepít) | „Nyisd meg Safariban" + link másolása |
| `mac-safari` | macOS Safari 17+ | „Fájl → Hozzáadás a Dockhoz…" útmutató |
| `unsupported` | Firefox asztali, régi böngésző, webview | „Ez a böngésző nem tud appot telepíteni — használd Chrome-ot/Edge-et/Safarit" + a naptár-feed ajánlása |
| `dismissed` | a felhasználó elutasította a promptot | 7 napig nem erőszakoskodunk (localStorage, `try/catch`) |

**Követelmények:** a `beforeinstallprompt`-ot **el kell kapni és eltárolni** (`preventDefault()`), a gombnyomásra hívni; sikeres telepítés után (`appinstalled`) a gomb eltűnik / „Telepítve" lesz. A komponens **tesztelhető** legyen: az állapot-felismerés tiszta függvény (`detectInstallState(env)`), vitest-tel lefedve minden ágra.

**Felirat (HU/EN):** „Alkalmazás letöltése" / "Download the app" — a gazda szava a „download".

**Platformonkénti telepítés (útmutató a `/install` oldalra):**

| Eszköz | Lépések |
|---|---|
| **Android** (Chrome) | „Letöltés" gomb → **Telepítés** (vagy ⋮ menü → *Alkalmazás telepítése*). |
| **iPhone / iPad** (Safari) | Megosztás ⬆ → *Kezdőképernyőhöz adás* → *Hozzáadás*. Utána az appot **onnan** nyisd meg, és ott kapcsold be az értesítéseket. |
| **Windows / macOS / Linux** (Chrome, Edge) | A „Letöltés" gomb, vagy a címsor jobb szélén a telepítés-ikon (⊕). |
| **macOS** (Safari 17+) | *Fájl → Hozzáadás a Dockhoz…* |
| **Firefox asztali** | Nem telepíthető; használd böngészőlapként (a push működik). |

### 13.4 Cache-szabályok a service workerben (🔴 adatvédelmi + frissesség)

| Erőforrás | Stratégia | Indok |
|---|---|---|
| Navigáció (HTML, RSC) | **hálózat**; hiba esetén `/offline.html` | **Hitelesített HTML nem cache-elhető** (közös eszköz, elavult adat) |
| `/_next/static/*`, `/icons/*` | cache-first (hash-elt, megváltoztathatatlan) | gyors indulás |
| `/api/*`, Supabase (`*.supabase.co`), push, képek (külső) | **érintetlen**, nem cache-eljük | adat/titok |
| `/offline.html` | precache | az egyetlen offline tartalom; önálló, JS-mentes, HU/EN (nyelv a `navigator.language`-ből) |
| `/sw.js` | `Cache-Control: no-cache` + `updateViaCache: 'none'` | a frissítések azonnal észlelhetők |

**Offline viselkedés v1:** hálózat nélkül az app az `offline.html`-t mutatja („Nincs kapcsolat — az emlékeztetőid biztonságban vannak, és az értesítések ettől még megérkeznek." — igaz, mert a küldés szerver-oldali). Írásvédett offline nézet (IndexedDB cache) **P2**.

### 13.5 Telepített app extrák

- **App-jelvény:** `navigator.setAppBadge(n)` — n = lejárt + 3 napon belül esedékes tételek; app-megnyitáskor és push-eseményre frissül; `clearAppBadge()` ha 0.
- **Shortcuts** (a manifestben, §13.1): hosszú nyomás az ikonon → *Új emlékeztető*, *Következő esedékesek*, *Analitika*.
- **Frissítés-értesítés:** ha új SW „waiting" állapotba kerül → toast: „Új verzió érhető el — **Frissítés**" → `postMessage('SKIP_WAITING')` + újratöltés.
- **Standalone-érzékelés** a `<html data-display-mode="standalone">` attribútumban (CSS/JS egyaránt használja: pl. a „Maradjak bejelentkezve" elrejtése, §10.3).

### 13.6 Natív csomagolás (P2, csak ha kell)

Ha a PWA-push iOS-korlátai (telepítés szükséges) vagy az áruházi jelenlét kell: **Capacitor** (iOS+Android natív push) vagy **TWA/Bubblewrap** (Google Play). Ez külön döntés (`DECISIONS.md`); v1-ben **nincs**.

### 13.7 Elfogadási kritériumok (PWA)

1. Chrome DevTools → *Application → Manifest*: nincs hiba; „Installability" ✔.
2. Android Chrome-on a „Letöltés" gomb telepít; az ikon a kezdőképernyőn; indítás standalone módban.
3. iPhone Safari-n az útmutató végigvihető; a telepített appban az értesítés-bekapcsolás működik.
4. Windows Chrome/Edge: telepítés → külön ablakban nyílik; push megjön.
5. Offline (repülő mód): `offline.html` jelenik meg, nem fehér képernyő, nem hitelesített adat.
6. Kijelentkezés után **nincs** cache-elt, felhasználói adatot tartalmazó válasz a SW-cache-ben (teszt: `caches.keys()` + tartalom-ellenőrzés).
7. Új SW-verzió: a toast megjelenik, a frissítés után az új verzió fut.

---

## 14. UI/UX specifikáció

> **Irány (a referencia-képek alapján, Függelék B):** fehér, levegős, kerek kártyás, vékony vonalas felület; a „nagy szám + színes fánk" mint főszereplő; mobilon alsó fül-sáv; asztalon oldalsáv + két oszlop; sötét módban mély palaszürke, lila/zöld hangsúlyokkal (ref-4).

### 14.1 Tervezési elvek

1. **Egy képernyő = egy fő feladat.** A „+" mindig elérhető, a legfontosabb adat (következő esedékes + havi összeg) a dashboard tetején.
2. **Az alapértelmezés a barátod.** Az új emlékeztető 3 mezővel (név, összeg, hányadikán) menthető; minden más opcionális és összecsukva.
3. **Szín nem hordoz egyedül jelentést.** Minden állapot = szín **+ ikon + szöveg** (lejárt: 🔴 `AlertCircle` + „Lejárt"). WCAG 2.2 AA.
4. **Gyors visszajelzés:** optimista UI (`useOptimistic`), toast + **Visszavonás** a destruktív/állapotváltó műveleteknél (kifizettem, törlés).
5. **Skeleton, nem spinner.** Üres állapotok *tanítanak* (illusztráció + 1 mondat + 1 gomb).
6. **Pénz = tabular figures** a listákban (`font-variant-numeric: tabular-nums`), a hero számok arányos számjegyekkel.

### 14.2 Design tokenek (`app/globals.css`, Tailwind v4 `@theme`)

| Token | Világos | Sötét | Használat |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0F1216` | oldal háttér (**fehér** — a gazda kérése) |
| `--surface` | `#FFFFFF` | `#171B21` | kártya |
| `--surface-2` | `#F6F8FA` | `#1E242C` | beágyazott panel, input háttér |
| `--border` | `#E7EAEE` | `#2A313A` | kártya/elválasztó vonal |
| `--text` | `#0F1720` | `#F1F5F9` | elsődleges szöveg |
| `--text-2` | `#475569` | `#CBD5E1` | másodlagos |
| `--text-muted` | `#64748B` | `#94A3B8` | halvány (≥ 4.5:1 kell maradjon) |
| `--primary` | `#0B7F70` | `#2DD4BF` | márka/gomb/aktív fül (fehér szöveg a gombon: ≈ 4.9:1) |
| `--primary-fg` | `#FFFFFF` | `#04201C` | szöveg a primary-n |
| `--primary-soft` | `#E6F4F1` | `#12302C` | halvány kiemelés |
| `--success` / `--success-text` | `#0CA30C` / `#006300` | `#0CA30C` / `#4ADE80` | kifizetve, „megtakarítás" |
| `--warning` / `--warning-text` | `#FAB219` / `#8A5A00` | `#FAB219` / `#FBBF24` | hamarosan, figyelem |
| `--danger` / `--danger-text` | `#D03B3B` / `#B42318` | `#D03B3B` / `#F87171` | lejárt, túllépés |
| `--ring` | `#0B7F70` @ 40% | `#2DD4BF` @ 50% | fókusz-gyűrű (2 px + 2 px offset) |

- **Sugarak:** kártya `16px`, input/gomb `12px`, chip/pill `999px`, bottom-sheet felső `24px`.
- **Árnyék:** világos: `0 1px 2px rgba(15,23,32,.04), 0 8px 24px rgba(15,23,32,.06)`; sötét: **nincs** árnyék, csak 1 px border.
- **Térköz:** 4 px-es skála; oldal-padding 16 (mobil) / 24 (tablet) / 32 (asztal); tartalom max. 1200 px.
- **Betű:** **Inter** `next/font` (`subsets: ['latin','latin-ext']` — 🔴 az **ő/ű** miatt). Méretek: hero szám 36–44/1.1 (600), H1 24, H2 18, törzs 16 (mobilon az **input ≥ 16 px**, különben az iOS ráközelít), kicsi 13.
- **Diagram-színek:** külön, **validált** paletta (§15.3), nem a `--primary`.
- **Mozgás:** 150–200 ms, `ease-out`; `prefers-reduced-motion: reduce` → nincs mozgás (csak átfedés).
- **Kontraszt:** a tokenpárokra *kontraszt-teszt* (**B-06**): minden szöveg/háttér pár ≥ 4.5:1 (nagy szöveg ≥ 3:1).

### 14.3 Elrendezés és navigáció

| Töréspont | Szerkezet |
|---|---|
| **< 768 px (mobil)** | Felső sáv (logó/üdvözlés · 🔔 · avatar) · tartalom · **alsó fül-sáv**: *Főoldal · Emlékeztetők · Analitika · Keretek · Még* · lebegő **„+" (FAB)** a Főoldalon és az Emlékeztetőkön (a fül-sáv fölött, jobbra) |
| **768–1023 px (tablet)** | Bal oldali **ikon-sín** (összecsukott oldalsáv, felirat tooltipben) + tartalom; a FAB marad |
| **≥ 1024 px (asztal)** | Bal **oldalsáv** (248 px): logó · *Főoldal, Emlékeztetők, Naptár, Analitika, Keretek, Megtakarítás, Tippek, Hírek* · alul: *Alkalmazás letöltése*, felhasználói chip (avatar+név → Profil) · felül jobbra 🔔 |

- **„Még" lap (mobil):** bottom-sheet: *Naptár, Megtakarítás, Tippek, Hírek, Profil, Alkalmazás letöltése*.
- Biztonságos terület: `padding-bottom: env(safe-area-inset-bottom)` az alsó sávnál.
- Aktív elem: `aria-current="page"`, `--primary-soft` háttér + `--primary` ikon/szöveg.
- „Ugrás a tartalomhoz" link (skip link) minden oldalon.

### 14.4 `/login` és `/signup`

```
 ┌───────────────────────────────┐
 │         🔔  Bank Reminder      │
 │   Soha többé elfelejtett számla │
 │ ┌───────────┬───────────────┐  │
 │ │  Belépés  │  Regisztráció │  │   ← fülek (két külön útvonal)
 │ └───────────┴───────────────┘  │
 │  E-mail                         │
 │  [______________________]       │
 │  Jelszó                  (👁)   │
 │  [______________________]       │
 │  [x] Maradjak bejelentkezve     │   ← alapból bepipálva (PWA-ban rejtett)
 │               Elfelejtett jelszó?│
 │  [        Belépés        ]      │   ← primary, teljes szélesség
 │ ─────────── vagy ───────────    │   (v1-ben nincs OAuth → ez a sor nincs)
 │  📲 Alkalmazás letöltése         │   ← InstallButton (szöveges link)
 │  HU | EN          ☀/🌙           │
 │  A Bank Reminder nem bank. …    │   ← §9.5
 └───────────────────────────────┘
```
Asztalon: kártya középre (max. 440 px) világos/halvány háttér-mintával. **Regisztráció** fül: *Név, E-mail, Jelszó (+erősség-sáv + követelmény-lista), Nyelv, [x] Elfogadom az Adatkezelési tájékoztatót és az ÁSZF-et*. Hibák **mező alatt** (`aria-describedby`), a fókusz az első hibás mezőre ugrik. Gomb-állapotok: `pending` → szöveg „Belépés…" + letiltva (dupla-submit védelem).

### 14.5 Főoldal / Dashboard (`/dashboard`) — ref-1, ref-3

**Mobil (fentről lefelé):**

```
 ┌───────────────────────────────┐
 │ Szia, Szabi 👋        🔔  (👤) │
 │ ‹  2026. október  ›            │   ← hónap-váltó
 │ ┌───────────────────────────┐ │
 │ │ Havi kiadás               │ │   ← HERO kártya
 │ │ 128 400 Ft   ▲ 6% a múlthoz│ │
 │ │   ◜◝  fánk-diagram ◞◟     │ │   (kategória-csoportok, közepén az összeg)
 │ │ ● Rezsi 42 000   ● Hitel 30 000 │ │   ← jelmagyarázat értékekkel
 │ └───────────────────────────┘ │
 │ Hamarosan esedékes     Mind › │
 │ ┌───────────────────────────┐ │
 │ │ [N] Netflix    holnap  2 300 │ │   ← sor: logó · név · mikor · összeg
 │ │      ✓ Kifizettem  ⏰ Később │ │      + gyorsgombok
 │ │ [E] Áram       okt. 18  14 200│ │
 │ └───────────────────────────┘ │
 │ Előfizetések  38 900 Ft/hó      │   ← „évente 466 800 Ft" alcím
 │ [N Netflix 2300][S Spotify 1990]…→ │   ← vízszintes chip-sor
 │ Költségkeretek                  │
 │ Élelmiszer ▓▓▓▓▓░░ 62%          │   ← max. 3 sáv
 │ 💡 Tipp: Átfedő előfizetések …  │   ← 1 tipp-kártya
 │ 📰 Hírek ‹kártya›‹kártya›‹kártya›│   ← vízszintes görgetés, képpel
 │ 📲 Töltsd le az appot [Letöltés]│   ← elvethető
 └───────────────────────────────┘
```

**Asztal (≥ 1024):** bal oszlop (8/12): hero kártya + „Hamarosan esedékes" + 6-havi trend; jobb oszlop (4/12): Előfizetések, Költségkeretek, Tipp, Megtakarítási célok. Alul: Hírek-sáv. (Elrendezés a ref-3 asztali nézetéhez hasonló: bal „Bills list", jobb „Upcoming reminders".)

**Adat:** `dashboard_summary(month)` RPC egyetlen hívásban (hero számok, csoportok, következő 5, előfizetés-összesítő, top 3 keret, 1 tipp) → egy RSC-hívás, kevés kliens-JS.

### 14.6 Emlékeztetők

**Lista (`/reminders`)** — ref-3 „Bills List":
- Fejléc: keresőmező · szűrők (*Mind · Számlák · Előfizetések · Lejárt*) · rendezés (esedékesség / összeg / név).
- Csoportok: **Lejárt** (piros szalag) · **Ezen a héten** · **Később ebben a hónapban** · **Jövő hónap** · **Szüneteltetett**.
- Sor: logó/ikon (katalógus vagy kategória-ikon) · név · alcím (*„havonta · 10-én"*) · esedékesség (relatív: „holnap") · összeg · **🔔 kapcsoló** (az emlékeztetőnkénti értesítés be/ki, mint a ref-3 toggle-ja) · „⋯" menü.
- Mobilon húzás-művelet *kiegészítés* (jobbra „Kifizettem", balra „Később") — a gombok mindig láthatók is (a11y).
- Üres állapot: „Még nincs emlékeztetőd. Vedd fel az elsőt 20 másodperc alatt." + [Új emlékeztető] + gyors-katalógus chipek (*Netflix, Spotify, Áram, Internet…*).

**Új/Szerkesztés űrlap (`/reminders/new`, `/reminders/[id]/edit`):**

| Szakasz | Mezők |
|---|---|
| **Alap** | **Név** (katalógus-autocomplete: logó + kategória + tipikus ár *javaslat*) · **Összeg** + **pénznem** (HUF alap; EUR, USD, … lista) · **Kategória** (csipek; a katalógusból előtöltve) |
| **Mikor** | **Ismétlődés** szegmens: *Egyszeri · Hetente · Havonta · Évente · Egyéni* · *Havonta* esetén: „Minden hónap **[10.]** napján" + „hónap utolsó napja" kapcsoló · *Egyéni*: „Minden **[N]** [nap/hét/hónap/év]" · **Első esedékesség** dátum (a következő érvényes dátumra előtöltve) · **Előnézet:** „Következő: nov. 10., dec. 10., jan. 10." (`preview_dates` RPC) |
| **Értesítés** | **Kapcsoló: Értesítés** (be) · **Mikor szóljunk:** chipek *aznap · 1 nap · 2 nap · 3 nap · 1 hét* (többes, max. 5) + egyéni szám · **Idő** (alap: a profilból, 09:00) · **Csatornák:** Push (alap) · E-mail |
| **Továbbiak** (összecsukva) | *Előfizetés* kapcsoló (katalógusból automatikusan) · *Ingyenes próba vége* dátum · *Csoportos beszedés — automatikusan kifizetettnek jelöl* · Megjegyzés (⚠ „Ne írj ide jelszót/számlaszámot") · Link · *Miért tartom meg?* (címkék: sorozatok, sport, zene, gyerek, munka… — a tippekhez) · Lezárás dátuma |

Mentés: ragadós alsó gomb (mobilon). Validáció a zod-sémával (`lib/schemas/reminder.ts`); a szerver újra-validál. **Nem engedett:** negatív összeg, 80 karakternél hosszabb név, > 5 offset, 31-nél nagyobb offset, múltbeli „első esedékesség" **új** emlékeztetőnél (figyelmeztetés + javaslat a következő dátumra).

**Részletek (`/reminders/[id]`):** fejléc (logó, név, összeg, „következő: holnap") · gombok: **Kifizettem · Halaszt · Kihagy · Szerkeszt · Szüneteltet · Törlés** · **Előzmények** (esedékességek: dátum, összeg, állapot; **árváltozás kiemelve**: „▲ +300 Ft") · mini vonaldiagram az összeg alakulásáról (ha ≥ 3 adatpont) · hozzá tartozó tippek.

### 14.7 Naptár (`/calendar`) — F-16

Hónap-rács (hétfő az első nap), a napokon **pöttyök** (méret/szám = tételek száma; szín = kategória-csoport), a mai nap kerettel. Nap koppintás → alul lista (bottom-sheet). Fejlécben: **„Naptár-link másolása / Hozzáadás a naptárhoz"** (§12.8). Mobilon a rács + alatta „Agenda" lista váltható.

### 14.8 Analitika (`/analytics`) — részletesen a **§15**

### 14.9 Költségkeretek (`/budgets`) és Megtakarítás (`/savings`) — részletesen a **§16**

### 14.10 Tippek (`/tips`) és Hírek (`/news`) — részletesen a **§17**, **§18**

### 14.11 Onboarding (`/onboarding`) — F-24

3 lépés, kihagyható, a végén `profiles.onboarding_done = true`:
1. **Üdv + nyelv/téma:** nyelv (HU/EN), téma (világos/sötét/rendszer) — élő előnézet; időzóna automatikusan (`Intl.DateTimeFormat().resolvedOptions().timeZone`), alap-pénznem.
2. **Első emlékeztető:** katalógus-chipek (*Netflix, Spotify, HBO Max, Áram, Gáz, Internet, Telefon, Albérlet*) → az űrlap előtöltve; vagy „Később".
3. **Értesítés + telepítés:** „Kapcsoljuk be az értesítéseket ezen az eszközön" (gesztus → engedélykérés) + **Letöltés** gomb (InstallButton) + iOS-en az útmutató.

### 14.12 Állapotok minden oldalra

| Állapot | Megoldás |
|---|---|
| Betöltés | `loading.tsx` skeletonok a kártyák alakjában (nincs elugró elrendezés) |
| Üres | Tanító üres állapot (illusztráció + 1 mondat + 1 gomb) |
| Hiba | `error.tsx`: barátságos szöveg + „Újra" gomb + (fejlesztői módban) részlet; a hiba **nem** tartalmaz PII-t |
| Offline | `offline.html` (§13.4); űrlapnál mentéskor: „Nincs kapcsolat — próbáld újra" (v1: nincs offline írás) |
| Jogosulatlan | `/login?next=…` |
| 404 | saját oldal „Nem találjuk" + vissza a főoldalra |

### 14.13 Komponens-katalógus (`components/`) — B építi, mindhez `props` + fixture

`AppShell` · `BottomNav` · `Sidebar` · `TopBar` · `Fab` · `MonthSwitcher` · `StatCard` · `BillRow` · `BillGroup` · `AmountText` · `CategoryChip` · `CategoryIcon` · `ServicePicker` (autocomplete) · `RecurrencePicker` · `OffsetChips` · `ReminderForm` · `PayButton` (optimista) · `SnoozeMenu` · `EmptyState` · `Skeleton*` · `Toast`/Undo · `BottomSheet` · `ConfirmDialog` · `AvatarUploader` · `InstallButton` · `PushToggle` · `PushDiagnostics` · `LanguageSwitch` · `ThemeSwitch` · `NotificationBell` · `InboxList` · `TipCard` · `NewsCard` · `FreshnessBadge` · `BudgetBar` · `GoalCard` · diagramok (§15).

**Fejlesztői játszótér:** `/dev/ui` (csak `NODE_ENV !== 'production'`) — minden komponens fixture-adatokkal, világos/sötét, HU/EN, → **ezzel tud B az A munkájától függetlenül haladni** (§24).

### 14.14 Hozzáférhetőség (a11y) — kötelező

- Billentyűzet: minden elem elérhető, látható fókusz; `Esc` zárja a dialógust; fókusz-csapda a modálisban; fókusz visszaadása.
- Képernyőolvasó: ikon-gombokon `aria-label`; diagramokhoz **táblázat-nézet** (§15.5) és `role="img"` + összegző `aria-label`; dinamikus változás `aria-live="polite"` (toast, számláló).
- Űrlap: `label` minden mezőhöz, hibák `aria-describedby`, `autocomplete` attribútumok (`email`, `current-password`, `new-password`, `name`).
- Cél-méret ≥ 44×44 px; kontraszt AA; nagyított szöveg (200%) nem tör.
- `axe` automata teszt minden fő oldalra (**B-29**); manuális: VoiceOver (iOS) és TalkBack egy-egy átfutás.

### 14.15 Hangnem (microcopy)

Barátságos, tömör, tegező (HU) / „you" (EN). Nincs ijesztgetés („Lejárt" nem „KÉSEDELEM!"). Összegek mindig a profil nyelvén formázva (§20.3). Kezdőkészlet: **Függelék D**.

---

## 15. Analytics és diagramok

> **A gazda kérése:** „legyen analytics ahol mutatja a havi kiadásod, olyan, mint a képeken; +1-2-3 chart és diagram is."

### 15.1 Az oldal felépítése (`/analytics`)

```
 ┌ Fejléc: ‹ 2026. október ›   [Hónap | 3 hó | 6 hó | 12 hó | Idén]   (Táblázat ⇄ Diagram) ┐
 │ KPI-sor (4 kártya, mindegyikben sparkline):                                                │
 │   Havi kiadás · Kifizetve eddig · Még hátravan · Előfizetések (évesítve)                   │
 ├────────────────────────────────────────────┬──────────────────────────────────────────────┤
 │ C1  Kategóriák (fánk)                      │ C2  Havi trend (oszlop, 6–12 hó)             │
 ├────────────────────────────────────────────┼──────────────────────────────────────────────┤
 │ C3  A hónap lefutása (kumulatív vonal)     │ C4  Top 5 tétel (vízszintes sáv)             │
 ├────────────────────────────────────────────┴──────────────────────────────────────────────┤
 │ C5  Kategóriák alakulása (halmozott oszlop, 6 hó)   │ C6  Következő 30 nap (idővonal)     │
 ├───────────────────────────────────────────────────────────────────────────────────────────┤
 │ C7  Előfizetések költsége (lista: havi · éves · részesedés)                               │
 │ Meglátások (automatikus mondatok): „A kiadás +8% az előző hónaphoz képest…"                │
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```
Mobilon a rács 1 oszlop, a diagramok vízszintesen nem görgetnek (a sűrű diagramok tömörített változata); a „Táblázat" kapcsoló mindenhol elérhető.

### 15.2 Adatforrások (RPC-k, §21) és a mérőszámok pontos definíciója

| Fogalom | Definíció |
|---|---|
| **Tervezett (planned)** | az adott hónapban esedékes, **nem kihagyott** esedékességek összege (alap-pénznemben, `due_date`-napi árfolyam) |
| **Kifizetett (paid)** | `status='paid'` esedékességek (`paid_amount` ha van, különben `amount`), a **`paid_on`** hónapja szerint **+ a hónap `expenses`-e** |
| **Hátralévő (remaining)** | `upcoming` esedékességek a hónapban (a lejárt is) |
| **Havi kiadás (hero)** | `paid + remaining` (az **elköteleződés**; a kihagyott nem számít) |
| **Előfizetés-költség** | `is_subscription` emlékeztetők havi-egyenértékes összege: havi ×1; negyedéves ÷3; éves ÷12; heti ×52/12; „egyéni" a periódus szerint; **éves** = havi × 12 |
| **Δ előző hónaphoz** | `(hero − hero_prev) / hero_prev`; ha `hero_prev = 0` → „—" (nincs osztás nullával) |

Hiányzó árfolyam esetén az adott tétel **kimarad az összegből és a UI jelzi** („1 tétel árfolyam nélkül"), nem számol 0-val.

### 15.3 Színpaletta (🔴 validált — `dataviz` módszer)

**Kategória-csoportok fix színei** (a szín az *entitást* követi, nem a rangsort; sosem kerül újraszínezésre szűrés miatt):

| Slot | Tematika | Világos | Sötét | Csoport (Függelék C) |
|---|---|---|---|---|
| 1 | kék | `#2A78D6` | `#3987E5` | Előfizetések |
| 2 | narancs | `#EB6834` | `#D95926` | Lakhatás & rezsi |
| 3 | aqua | `#1BAF7A` | `#199E70` | Telefon & internet |
| 4 | sárga | `#EDA100` | `#C98500` | Biztosítás & adó |
| 5 | magenta | `#E87BA4` | `#D55181` | Hitel & díjak |
| 6 | zöld | `#008300` | `#008300` | Mindennapi (élelmiszer, háztartás, közlekedés) |
| 7 | lila | `#6250D6` | `#9085E9` | Életmód & család |
| 9 | szürke | `#98A2B3` | `#6B7686` | Egyéb |
| — | *(8. = piros: **nincs** kategóriához rendelve; a piros a „túllépés/lejárt" állapot színe)* | | | |

- **Validálás** lefuttatva (2026-10-13) a *saját* felületekkel (világos `#FFFFFF`, sötét `#171B21`): **minden kapu PASS** mindkét módban — legrosszabb szomszédos CVD ΔE 9.1 (világos) / 8.4 (sötét); normál látás ≥ 19; sötét módban kontraszt ≥ 3:1.
- ⚠ **Világos módban 3 szín (aqua, sárga, magenta) kontrasztja < 3:1** a fehér felületen → **kötelező ellensúly:** látható értékfeliratok / jelmagyarázat-értékek és **táblázat-nézet** (§15.5). A szín soha nem az egyetlen jelentéshordozó.
- **Diagramonként max. 7 csoport + „Egyéb"**; a 8. sorozat sosem generált szín — „Egyéb"-be olvad.
- **Szekvenciális** (naptár-pöttyök, hőtérkép): egyszínű (`#CDE2FB`→`#0D366B`, kék rámpa). **Állapot-színek** (`--success/--warning/--danger`) **fenntartottak**, mindig ikon + felirat kíséretében.
- Ha a gazda a márkaszínt megváltoztatja, a paletta **újra-validálandó** (`node …/validate_palette.js "<hex,…>" --mode light|dark --surface <felület>`), mielőtt bármi változik.

### 15.4 A diagramok részletesen

| ID | Diagram | Típus / lib | Adat (RPC) | Megjelenítési szabályok |
|---|---|---|---|---|
| **C1** | **Kategória-fánk** (ref-1) | Donut (Recharts `PieChart`, `innerRadius` 64–72%) | `analytics_by_group(from,to)` | ≤ 7 szelet + „Egyéb"; **2 px felület-színű rés** a szeletek közt; közepén a **hero összeg** + „október"; jelmagyarázat: pötty · név · **összeg** · **%** (értékfelirat = ellensúly); hover/koppintás: tooltip (név, összeg, %, tételek száma); szelet-kattintás → a kategória-lista szűrése alul |
| **C2** | **Havi trend** | Halmozott oszlop | `analytics_monthly_trend(months)` | x: hónapok; sorozatok: **Kifizetett** (tömör) + **Hátralévő** (csíkozott/körvonalas; textúra = a11y); 4 px lekerekített *felső* vég, alapvonalhoz kötve; 2 px rés a halmozott szegmensek közt; vízszintes szaggatott **átlag-vonal**; az aktuális hónap kiemelve; **egy** y-tengely (nincs duplatengely) |
| **C3** | **A hónap lefutása** | Vonal + halvány terület | `analytics_cumulative(month)` | x: a hónap napjai; y: kumulatív **kifizetett+tervezett**; vonalak: *Ez a hónap* (tömör, 2 px) és *Előző hónap* (szaggatott, halvány); közvetlen felirat a vonalak végén; ha van teljes-keret (budgets): vízszintes **Keret** vonal; crosshair + tooltip (nap, összeg, a nap tételei) |
| **C4** | **Top 5 tétel** | Vízszintes sáv | `analytics_top(from,to,5)` | vékony sávok, értékfelirat a végén; szín = a tétel kategória-csoportja |
| **C5** | **Kategóriák alakulása** | Halmozott oszlop (6 hó) | `analytics_group_trend(6)` | csoportonként fix szín; jelmagyarázat (kattintható szűrés) |
| **C6** | **Következő 30 nap** | Idővonal-sáv / „hőcsík" | `upcoming_days(30)` | napi pötty/oszlop az összeggel; a nap koppintható → tétel-lista; a „sűrű" napok (a hónap összegének ≥ 40%-a 3 napban) jelölve |
| **C7** | **Előfizetések költsége** | Lista + vékony sávok | `analytics_subscriptions()` | név · havi · **éves** · részesedés %; fenn nagy szám: **„évente 466 800 Ft"** (a „csendes pénzfaló" feltárása) |
| **K1–K4** | KPI-kártyák | Stat-kártya + **sparkline** (6 hó) | `dashboard_summary` | nagy szám + Δ (▲/▼ **ikon + előjel + szín**, nem csak szín); a „kiadás nő" = figyelmeztető (nem zöld) |
| **S1** | **Megtakarítási célok** | Folyamatjelző sáv / gyűrű | `savings_goals_progress` | §16.4 (ref-2) |
| **B1** | **Keret-sávok** | Vízszintes folyamatjelző | `budget_status(month)` | §16 (ref-4) |

### 15.5 Interakció és hozzáférhetőség (kötelező minden diagramra)

- **Hover/koppintás tooltip** minden jelölésen (a találati terület nagyobb, mint a jel); billentyűzettel is elérhető (nyilak a pontok közt).
- **Jelmagyarázat** ≥ 2 sorozatnál mindig; ≤ 4 sorozatnál **közvetlen felirat** is.
- **Táblázat-nézet** kapcsoló: a diagram adatai `<table>`-ben (képernyőolvasó- és CVD-barát; az aqua/sárga/magenta kontraszt-ellensúlya).
- **Szöveges összegzés** (`aria-label`): pl. „Kategóriák október: Rezsi 42 000 Ft (33%), Hitel 30 000 Ft (23%) …".
- **Szűrők egy sorban** a diagramok fölött (hónap-váltó + tartomány-chipek); szűrés nem festi át a túlélő sorozatokat.
- **Nincs duplatengely**; két eltérő nagyságrendű mérték → két diagram.
- **Sötét mód:** külön lépcsők (a fenti táblázat), nem automatikus inverz.
- **Betöltés:** a diagramok `next/dynamic` (lazy) — a Recharts nem kerül az első betöltés csomagjába.
- **Textúra** (`forced-colors`/nyomtatás/CVD-beállítás): a „Hátralévő" csíkozott; a fánk szeletei opcionálisan 45°/135° vonalkázással (Profil → Megjelenés → „Kontrasztosabb diagramok").

### 15.6 Meglátások (egy sornyi automatikus mondat — determinisztikus)

„A kiadásod **+8%** az előző hónaphoz képest." · „A legnagyobb tétel: **Albérlet** (65 000 Ft)." · „Az előfizetéseid a havi kiadás **30%-át** teszik ki." · „A hónap **első 10 napjában** esik a kiadás 70%-a." — mindegyik egy `code + params` pár, a szöveg a `locales`-ból (ugyanaz az elv, mint a tippeknél, §17).

---

## 16. Költségkeretek és megtakarítási célok

### 16.1 Spending & Budgets (`/budgets`) — ref-4

```
 ┌───────────────────────────────────────┐
 │ ‹  Költségkeretek · okt.  ›        [+] │
 │  1 870 Ft  elköltve  /  2 535 Ft keret │   ← összesítő (nagy szám)
 │  ▓▓▓▓▓▓▓▓▓▓▓░░░░  74%                  │
 │ ┌───────────────────────────────────┐ │
 │ │ 🛒 Élelmiszer      200 Ft maradt    │ │
 │ │ ▓▓▓▓▓▓▓▓░░░░               400/600 │ │   ← sáv + elköltött/keret
 │ │ 👕 Ruházat   ⚠ 300 Ft túllépés      │ │   ← PIROS sáv + „!" ikon + szöveg
 │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓           400/100  │ │
 │ │ 🍽 Étterem        100 Ft maradt     │ │
 │ └───────────────────────────────────┘ │
 │ Még nincs kerete: Utazás, Egészség  [+ Keret]│
 └───────────────────────────────────────┘
```

**Számítás** (`budget_status(month)`, alap-pénznemben):

| Mező | Képlet |
|---|---|
| `spent` | kifizetett esedékességek (`paid_on` a hónapban, a kategóriában) + `expenses` (`spent_on` a hónapban, a kategóriában) |
| `committed` | a hónapban még `upcoming` (nem kifizetett) esedékességek a kategóriában |
| `left` | `limit − spent` |
| `state` | `over` ha `spent > limit` · `watch` ha `spent + committed > limit` vagy `spent ≥ 0.8·limit` · különben `ok` |
| `forecast` | (csak változó költésű kategóriákra, ahol `expenses` van) `spent / eltelt_napok × hónap_napjai + committed` |
| `suggested_limit` | az utolsó 3 hónap `spent` átlaga, felfelé kerekítve 1 000-re (Ft) / 10-re (EUR/USD) |

**Megjelenítés:** a sáv kitöltése a márka-akcent (sötétben lila árnyalat, mint ref-4) → `over` esetén **`--danger`** + `AlertCircle` ikon + „X Ft túllépés"; `watch` esetén `--warning` + ikon + „Közel a kerethez". A „még hátralévő számlák" (`committed`) **halványabb szegmens** a kitöltött rész után. A sáv szélessége 100%-nál nem csorbul (a túllépés számmal és ikonnal látszik, a sáv teljes + piros).
**Kattintás egy soron:** kategória-részlet (a hónap tételei: számlák + gyors kiadások), keret szerkesztése, „keret törlése".
**Új keret:** kategória-választó (csak amelyiknek még nincs) + összeg (javasolt érték előtöltve) → mentés.

### 16.2 Havi áttekintés a számolóhoz

A lap tetején **„Mennyit költhetsz még?"**: `összes_keret − összes_spent − összes_committed` (negatív esetén piros szöveg + ikon).

### 16.3 Gyors kiadás-rögzítés (F-12) ⭐

- A FAB-menüben: **„Gyors kiadás"** → alsó lap: összeg (nagy numerikus billentyűzet), kategória-chipek (a leggyakoribbak elöl), dátum (ma), megjegyzés. Mentés = 2 koppintás. `inputmode="decimal"`.
- Lista a keret-részletekben; visszavonás toast.
- Ez adja a keretek „valódi" élő számlálóját (különben csak az ismétlődő számlák számítanának).

### 16.4 Megtakarítási célok (`/savings`) — ref-2

- **Kártya:** ikon · név · **folyamatjelző** · `megtakarítva / cél` · „határidő: 2027. jún." · „**még 8 hónap — havi 31 250 Ft** kellene" (`needed_per_month = max(0, cél − megtakarítva) / hátralévő_hónapok`).
- **Műveletek:** *Hozzáadás* (+ összeg) · *Kivét* (− összeg) · előzmények · szerkesztés · archiválás. Cél elérésekor konfetti-**mentes**, visszafogott „Elérted! 🎉" állapot (a `prefers-reduced-motion`-t tiszteletben tartva).
- **Előkészített célok** (egy koppintással): *Vészhelyzeti alap* (a cél = **3 × az átlagos havi kiadás**, kiszámolva), *Nyaralás*, *Új telefon*, *Egyéni*.
- **Összekötés a tippekkel:** ha van „lemondható" előfizetés-tipp, a cél-kártya ajánlja: „Ha lemondod a(z) X-et, évi Y Ft → tedd ide" (egy koppintásos *Havi megtakarítás beállítása* — v1-ben csak emlékeztető-szintű: egy `reminder` „Megtakarítás a célra" jön létre, nem tényleges átutalás).

---

## 17. Tippek-motor

> **A gazda kérése:** tippek a megtakarításhoz — pl. ha van Netflix/HBO/Prime, és a Prime-ot nem fizeted, nem baj, mert minden más megtalálható a Netflixen és a HBO-n. A motor „mérjen fel rengeteg mindent, a legáltalánosabb dolgokat".

### 17.1 Alapelvek

1. **Determinisztikus szabályok, nincs generált szöveg (H7).** A DB *kódot + paramétereket* tárol (`tips.code`, `tips.params`); a mondat a `locales`-ból épül (HU/EN) — így a fordítás egy helyen él, és semmi nem „kitalált".
2. **Átlátható:** minden tipp-kártyán „**Miért látom ezt?**" — a bemenő adatok (pl. „Netflix és HBO Max egyaránt *online film/sorozat*; katalógus-adat: 2026-10"), a becslés módja.
3. **A felhasználó dönt:** *Nem érdekel* (örökre), *Később* (30 nap), *Megcsináltam* (számolódik a megtakarításba), *Részletek*.
4. **Becslés ≠ ígéret:** minden összeg „kb." jelölésű; a disclaimer (H10) látható (§17.6).
5. **Stabil ujjlenyomat:** ugyanaz a helyzet ugyanazt a `fingerprint`-et kapja → nem duplikálódik, az elvetett tipp nem tér vissza.
6. **Olcsó:** SQL függvény (`refresh_tips`), éjjel mindenkire + kérésre egy felhasználóra (új/módosított emlékeztető után, debounce-olva).

### 17.2 Bemenetek

`reminders` (+`usage_tags`) · `occurrences` (előzmény, késések) · `budgets` · `expenses` · `savings_goals` · `profiles.monthly_income` (opcionális) · `service_catalog` (`group_key`, `unique_tags`, `common_tags`, `annual_discount_pct`, `family_plan`, `verified_at`) · `tip_config` (küszöbök, kulcs→érték tábla, seed).

### 17.3 Szabálykatalógus

> **Pri:** `P0` = MVP-ben kötelező, `P1` = első bővítés, `P2` = később. **Szint:** `save` (megtakarítás), `warn` (figyelmeztetés), `info` (ötlet). A „HU minta" csak szemléltet — a végleges szöveg a `locales/hu.json`-ban él.

| Kód | Mit észlel (feltétel) | `params` | Becsült megtakarítás | Szint | Pri | HU minta |
|---|---|---|---|---|---|---|
| `sub_overlap_group` | ≥ 2 aktív előfizetés **ugyanabban az átfedés-csoportban** (`group_key`: pl. `video_streaming`, `music_streaming`, `cloud_storage`) | `group`, `names[]`, `monthly_total` | a *legolcsóbb* tag havi díja | save | **P0** | „3 online filmes előfizetésed van (Netflix, HBO Max, Prime) — havi 7 800 Ft. Érdemes lehet váltogatni őket." |
| `sub_covered_by_others` | egy előfizetés tartalmi címkéi, amiket a felhasználó **megjelölt** (`usage_tags`), **mind elérhetők** a csoport többi tagjánál is (`unique_tags ∪ common_tags`) | `name`, `covered_by[]`, `tags[]` | az előfizetés havi díja | save | **P0** | „A Prime-ot azért tartod meg: *filmek, sorozatok* — ezek a Netflixen és a HBO Maxon is megvannak. Lemondhatod: kb. 1 990 Ft/hó." |
| `sub_maybe_redundant` | mint fent, de **nincs `usage_tags`**, és a `common_tags` ≥ 70%-a lefedett → *rákérdez* | `name`, `covered_pct` | a díj | info | **P0** | „Mit nézel a Prime-on? Jelöld be, és megmondjuk, érdemes-e megtartani." (→ chip-választó, ami kitölti a `usage_tags`-et) |
| `sub_annual_cheaper` | a katalógusban van éves-kedvezmény (`annual_discount_pct > 0`), a felhasználó havit fizet | `name`, `pct`, `yearly_saving` | `havi × 12 × pct` | save | **P0** | „A(z) X éves díjjal kb. 15%-ot spórolhatsz (≈ 4 000 Ft/év). Az adat 2026-10-i." |
| `sub_family_plan` | a katalógusban van családi csomag, és a felhasználó ≥ 1 egyéni csomagot fizet | `name` | — (becsült nincs) | info | P1 | „Ha többen vagytok, a családi csomag fejenként olcsóbb lehet." |
| `price_increase` | az utolsó esedékesség összege **≥ 5%-kal** nagyobb az előzőnél (`tip_config.price_increase_pct`) | `name`, `old`, `new`, `pct` | `new − old` (havi egyenértékben) | warn | **P0** | „A Netflix díja 2 000 → 2 300 Ft (+15%). Átnézed a csomagot?" |
| `trial_ending` | `trial_ends_on` ≤ 3 napon belül | `name`, `date`, `amount_after` | a próba utáni díj | warn | **P0** | „A(z) X ingyenes próbája 2 nap múlva lejár — utána 2 990 Ft/hó. Szükséged van rá?" (+ értesítés, §12) |
| `subs_share_high` | az előfizetések > 15% a havi kiadásnak (`tip_config.subs_share_pct`) vagy a jövedelemnek | `pct`, `monthly`, `yearly` | — | info | **P0** | „Az előfizetéseid a havi kiadásod 31%-át teszik ki (évi 466 800 Ft)." |
| `subs_count_high` | ≥ 8 aktív előfizetés | `count` | — | info | P1 | „8 előfizetésed van. Mikor használtad utoljára mindet?" |
| `unused_check` | 90 naponta, minden előfizetésre *rákérdez*: „Használtad az elmúlt hónapban?" (igen/nem); 2× „nem" → | `name` | az előfizetés díja | save | **P0** | „Kétszer jelezted, hogy nem használod a(z) X-et. Lemondod?" |
| `budget_over_now` | a kategóriában `spent > limit` | `category`, `over` | — | warn | **P0** | „Ruházat: 300 Ft-tal túllépted a keretet." |
| `budget_forecast_over` | a ritmus alapján (`forecast`) a hónap végére túllépné | `category`, `forecast`, `limit` | `forecast − limit` | warn | **P0** | „Ebben a tempóban az Élelmiszer keret a hónap 22. napján elfogy." |
| `category_spike` | a kategória e havi költése > 1.4 × a 3 havi átlag | `category`, `ratio` | a különbözet | warn | P1 | „Étterem: 1.8×-a a szokásosnak." |
| `duplicate_reminder` | két aktív emlékeztető nagyon hasonló névvel és azonos összeggel | `a`, `b` | az egyik díja | warn | **P0** | „A „Netflix" és a „Netflix HD" ugyanannak tűnik. Dupla fizetés?" |
| `late_payment_pattern` | az utolsó 6 esedékességből ≥ 2-t a határidő **után** jelöltek kifizetettnek | `name`, `count` | késedelmi díj elkerülése (nincs becslés) | info | **P0** | „A(z) X-et 2× késve fizetted. Állítsunk korábbi emlékeztetőt (2 nap)?" (egy koppintás: offset módosítás) |
| `payment_day_cluster` | a hónap tervezett összegének ≥ 40%-a 3 egymást követő napra esik | `days`, `share` | — | info | P1 | „A számláid 52%-a 3 napra esik. Kérj fizetési határidő-módosítást a fizetésnapodhoz?" |
| `fixed_cost_ratio` | a fix számlák > 60% a jövedelemnek (ha megadta) | `ratio` | — | warn | P1 | „A fix költségeid a jövedelmed 68%-át viszik." |
| `savings_rate_low` | az utolsó 3 hónapban a megtakarítás < 10% a jövedelemnek | `rate` | — | info | P1 | „Az elmúlt 3 hónapban a jövedelmed ~4%-át tetted félre." |
| `renewal_compare` | biztosítás/szolgáltatás **évfordulója ≤ 45 napon belül** (a *biztosítás/telefon/internet/rezsi* kategóriák éves ismétlődésű tételei) | `name`, `date` | — | info | P1 | „A(z) X éves díja 38 nap múlva megújul — érdemes összehasonlítani az ajánlatokat előtte." |
| `bank_fees_high` | a `bank_fees` kategória havi összege > küszöb (`tip_config.bank_fees_monthly`) | `monthly`, `yearly` | a különbözet a küszöbhöz | save | P1 | „A bankköltségeid havi 4 200 Ft (évi 50 400). Nézd meg a számlacsomagodat." |
| `telecom_bundle` | külön mobil + internet tétel(ek), különböző szolgáltatótól (`service_slug`) | `names[]` | — | info | P2 | „Kérj csomagajánlatot — gyakran olcsóbb együtt." |
| `foreign_currency_exposure` | az előfizetések ≥ 30%-a nem alap-pénznemben | `share`, `currencies[]` | — | info | P1 | „A díjaid 40%-a USD-ban megy, az árfolyam változhat." |
| `goal_behind` | a cél üteme elmarad a határidőtől | `goal`, `needed_per_month` | — | warn | P1 | „A(z) Nyaralás célhoz havi 31 250 Ft kellene, hogy időben elérd." |
| `goal_funded_by_cancel` | van lemondható tipp **és** van megtakarítási cél | `goal`, `from_tip` | a tipp megtakarítása | save | P1 | „Ha lemondod a Prime-ot, évi 23 880 Ft a Nyaralás célra mehet." |
| `emergency_fund` | nincs „vészhelyzeti alap" cél | `target` (3×havi kiadás) | — | info | P1 | „Érdemes 3 havi kiadásnyi (≈ 385 000 Ft) tartalékot gyűjteni." |
| `round_up_idea` | általános ötlet (havonta 1×, ha nincs más aktív tipp) | — | — | info | P2 | „Tegyél félre minden fizetéskor 5%-ot — előbb a megtakarítás, aztán a költés." |

### 17.4 A gazda példája végigvíve (Netflix / HBO / Prime)

**Katalógus** (a seed *csak ellenőrizhető* adatot tartalmazhat — H7; példaszerű szerkezet):

| `slug` | `group_key` | `unique_tags` | `common_tags` | `verified_at` |
|---|---|---|---|---|
| `netflix` | `video_streaming` | *(a szolgáltató saját eredeti tartalmai)* | `filmek`, `sorozatok`, `dokumentum`, `gyerek` | *(ellenőrzés dátuma)* |
| `hbo-max` | `video_streaming` | *(saját eredeti tartalmak)* | `filmek`, `sorozatok`, `dokumentum`, `gyerek` | |
| `prime-video` | `video_streaming` | *(saját eredeti tartalmak)* | `filmek`, `sorozatok` | |

**Folyamat:**
1. Felvesz 3 előfizetést → `sub_overlap_group` megjelenik („3 online filmes előfizetésed van…").
2. A tipp-kártya a Prime-nál megkérdezi: **„Mit nézel itt?"** → chipek: *filmek · sorozatok · saját eredeti műsorok · sport · gyerek · egyéb* → a kiválasztás a `reminders.usage_tags`-be kerül.
3. Ha a megjelölt címkék **mind lefedettek** a másik kettőnél (`common_tags ∪ unique_tags`) → `sub_covered_by_others`: „A Prime-on *filmeket, sorozatokat* nézel — ezek a Netflixen és a HBO Maxon is megvannak. Lemondhatod: **kb. 1 990 Ft/hó**." Ha a felhasználó *„saját eredeti műsorok"*-at jelölt → a motor ezt **nem** tekinti lefedettnek (ami `unique_tags`-ben csak ott van) → a tipp nem jelenik meg. **Így nem mondunk hülyeséget.**
4. „Megcsináltam" → az emlékeztető `is_active=false` (vagy a felhasználó törli) → a megtakarítás-számláló nő.

### 17.5 Életciklus

`new` → (megnyitva) `seen` → `dismissed` (örökre) | `snoozed` (`snoozed_until`, +30 nap) | `done`. A `refresh_tips()` *upsert*-el `fingerprint` szerint; ha a feltétel megszűnt és a státusz `new`/`seen` → a sor törlődik; a `dismissed`/`snoozed`/`done` sorok maradnak (nehogy visszatérjenek).

**Fingerprint-minták:** `overlap:<group>` · `covered:<reminderId>` · `annual:<reminderId>` · `price_up:<reminderId>:<occurrenceId>` · `budget_over:<categoryId>:<yyyy-mm>` · `trial:<reminderId>:<date>` · `dup:<minId>:<maxId>`.

### 17.6 UI (`/tips`)

- Fent: **„Összesen akár ≈ X Ft/hó (évi Y Ft) spórolható"** (csak a `save` szintű, `est_monthly_saving` összege; „kb." jelzéssel).
- Csoportok: **Spórolhatsz** (becsült összeg szerint csökkenő) · **Figyelj rá** (warn) · **Ötletek** (info).
- Kártya: ikon · cím · 1–2 mondat · becsült megtakarítás · gombok: **Részletek** (miért látom) · **Később** · **Nem érdekel** · **Megcsináltam**.
- Alul: **„Megcsináltad: ≈ X Ft/hó megtakarítás eddig"** (a `done` tippek összege).
- **Disclaimer (állandó):** *„A tippek általános becslések az általad megadott adatok és egy időnként frissített katalógus alapján; nem minősülnek pénzügyi tanácsadásnak. A szolgáltatók díjai és csomagjai változhatnak — mindig ellenőrizd a szolgáltatónál."* (HU/EN)
- Dashboard: max. 1 tipp (a legnagyobb becsült megtakarítású).

### 17.7 Tesztelés

pgTAP fixture-ök **minden P0 szabályra**: (adat → várt `tips` sor/sorok) + negatív eset (feltétel nem teljesül → nincs sor) + életciklus (dismiss után nem tér vissza) + a 17.4 forgatókönyv (a „saját eredeti műsorok" **nem** adja a tippet).

---

## 18. Hírek és akciók

> **A gazda kérése:** hírek a havi költségcsökkentésről; ha van **mindig lekérdezhető API**, jelenjen meg **képekkel, szöveggel, külön oldalon**; pl. „most a Tescóban 120 Ft-tal olcsóbb a tej ezen a héten"; **időérzékelő**, hogy ne legyen hamis hír.

### 18.1 Őszinte helyzetkép (felmérés: 2026-10-13)

Nincs olyan *hivatalos, nyílt, kulcs nélküli API*, ami a boltok aktuális akcióit strukturáltan adná. Amit **ténylegesen ellenőriztem és működik** (HTTP 200, érvényes RSS, időbélyegekkel): **kiadói RSS-csatornák**. Ezért a v1 hírforrása = **engedélyezőlistás kiadói RSS-ek**, a „Tescóban olcsóbb a tej" jellegű tételek pedig **hírcímekként** (forrással, dátummal) jelennek meg — **nem** mi állítjuk, hanem a kiadót idézzük, linkkel.

| Forrás (`key`) | Feed URL | Téma-javaslat | Állapot (2026-10-13) | Kép a feedben |
|---|---|---|---|---|
| `penzcentrum-vasarlas` | `https://www.penzcentrum.hu/rss/vasarlas.xml` | deals, prices | ✔ 200 | ✔ `enclosure` |
| `penzcentrum-megtakaritas` | `https://www.penzcentrum.hu/rss/megtakaritas.xml` | saving | ✔ 200 | ✔ `enclosure` |
| `penzcentrum-hitel` | `https://www.penzcentrum.hu/rss/hitel.xml` | banking | ✔ (a csatornalistában) | ellenőrizendő |
| `penzcentrum-biztositas` | `https://www.penzcentrum.hu/rss/biztositas.xml` | banking | ✔ (a csatornalistában) | ellenőrizendő |
| `penzcentrum-otthon` | `https://www.penzcentrum.hu/rss/otthon.xml` | utilities | ✔ (a csatornalistában) | ellenőrizendő |
| `portfolio-all` | `https://www.portfolio.hu/rss/all.xml` | general (kulcsszó-szűrve) | ✔ 200 | **ellenőrizendő** |
| `telex-all` | `https://telex.hu/rss` | general (kulcsszó-szűrve) | ✔ 200 | ✔ `enclosure` |
| `index-gazdasag` | `https://index.hu/gazdasag/rss/` | general (kulcsszó-szűrve) | ✔ 200 | ellenőrizendő |
| `hvg-gazdasag` | `https://hvg.hu/rss/gazdasag` | general (kulcsszó-szűrve) | ✔ 200 | ellenőrizendő |

> A *Pénzcentrum* RSS-jegyzékéből (`https://www.penzcentrum.hu/rss/`) további csatornák (`adozas`, `auto`, `gazdasag`, `nyugdij`, …) is elérhetők. **A-24** feladata az „ellenőrizendő" mezők kitöltése (kép, mezők), a csatornák **élő újra-tesztelése** a seed előtt, és **a kiadók felhasználási feltételeinek átnézése** (a gazda felelőssége a végső jóváhagyás — §26-Q6).

**Amit szándékosan NEM használunk:**

| Forrás | Miért nem |
|---|---|
| **Google News RSS** (`news.google.com/rss/search?…`) | Technikailag működik, de a feed saját fejléce szerint *„personal, non-commercial use … in a personal feed reader"* → egy alkalmazásban **sértené a feltételeket**. |
| **GVH Árfigyelő** (`arfigyelo.gvh.hu`) | Valódi, hivatalos, napi frissülő ár-összehasonlító (2023. júl. óta, 6 lánc, ~1200 bolt, 62 termékkategória) — **de nincs dokumentált nyilvános API/nyílt adat**; a weboldal belső `/api`-ját **nem** scrape-eljük. → **P2:** megkeresni a GVH-t, hogy van-e engedélyezett adatforrás. |
| **Bolti szórólap-/akcióoldalak** (Tesco, Lidl, Aldi, Spar, Auchan…) | Nincs hivatalos nyílt API; engedély nélküli scrape jogilag kockázatos → **P2** (partnerség/engedély). |
| `vg.hu/rss`, `mnb.hu/rss/sajtokozlemeny` | A tesztelt URL 404 — ha kell, az **A-24** megkeresi a helyes csatornát. |

**Strukturált, de *nem hír* adat (használjuk):** árfolyam — **Frankfurter** (`https://api.frankfurter.dev/v1/latest?base=EUR`, kulcs nélkül, ECB-adat; ellenőrizve: 200, `date` mezővel).

### 18.2 A betöltő (`news-ingest` Edge Function, 30 percenként)

1. **Forrásonként** feltételes GET (`If-None-Match`/`If-Modified-Since`), **10 mp** időkorlát, **2 MB** méretkorlát, `User-Agent: BankReminderBot/1.0 (+<kapcsolati URL>)`; forrásonként max. **1 kérés / 30 perc**; `robots.txt` tiszteletben tartva.
2. **Parse** (RSS 2.0; `fast-xml-parser` vagy egyenértékű), mezők: `title`, `link`, `description`, `pubDate`, `enclosure@url`/`media:content`.
3. **Normalizálás:**
   - `title`: HTML-entitások dekódolása, tagek eltávolítása, szóköz-összevonás, ≤ 300 kar.
   - `snippet`: HTML eltávolítása, **≤ 200 karakter szóhatáron + „…"** (idézet, nem cikk).
   - `url`: kanonizálás (`utm_*`, `fbclid`, fragment törlése) → egyedi kulcs.
   - `image_url`: csak **https**; kis méretű/ikon képek kihagyása nem lehetséges (nem töltjük le) → csak a feed által adott URL.
4. **Szűrés:** engedélyezőlistás domain (a `link` host a forrás hosztja) · **deny**-kulcsszavak (bulvár, sport, horoszkóp…) → eldob · **allow**-kulcsszavak (§18.4) → téma + pontszám; ha nincs találat a „general" forrásnál → eldob.
5. **Időellenőrzés (🔴 hamis hír ellen):** `published_at` hiányzik → eldob · **jövőbeli** (> most + 1 nap) → eldob · **30 napnál régebbi** → eldob.
6. **Deduplikálás:** `url` egyedi + **közel-duplikátum** (normalizált cím-hash, ±48 óra, több forrás közt → a korábbi/magasabb pontszámú marad).
7. **Lejárat (`expires_at = published_at + TTL[téma]`)**, **kemény plafon 30 nap**:

| Téma | TTL | Magyarázat |
|---|---|---|
| `deals` (akciók) | **7 nap** | heti szórólap-ciklus |
| `prices` (árak) | **7 nap** | |
| `utilities` (rezsi) | 21 nap | |
| `banking` (bank/hitel/biztosítás) | 21 nap | |
| `saving` (megtakarítás/tippek) | 30 nap | |
| `general` | 14 nap | |

8. **Upsert** a `news_items`-be; `news_sources`: `etag`, `last_modified`, `last_fetched_at`, `last_status`, `last_error`. Napló: darabszámok (`fetched/kept/dropped/dup`), **nincs** személyes adat.
9. **Karbantartás:** a `cleanup_daily` a lejárat + 60 napnál régebbi sorokat törli.

### 18.3 Hamis hír elleni védelem (H7) — ellenőrzőlista

1. Csak **engedélyezőlistás kiadók**; a forrás neve + link **mindig** látszik.
2. **Nincs generált összefoglaló/állítás**; a szöveg a kiadó saját `title`/rövid kivonata.
3. Minden tételnek **`published_at`** és **`expires_at`** van; lejárt tétel **nem látszik** (RLS: `expires_at > now()`).
4. A UI **mindig** kiírja az életkort („2 órája", „tegnap", „5 napja") és **állapotot** (`FreshnessBadge`): **Friss** (< 24 óra) · *(nincs jelzés)* · **„Lehet, hogy már nem aktuális"** (a TTL > 70%-a eltelt).
5. Az **akciós** tételeknél kötelező szöveg: *„Hírforrás alapján — az akció feltételeit és érvényességét ellenőrizd az üzletnél."*
6. **Számszerű állítás** (ár, %) csak **strukturált forrásból** (pl. árfolyam) és **`observed_at`**-tal jelenhet meg; a hírcímből *nem* kinyert szám.
7. Jövőbeli dátumú / időbélyeg nélküli tétel eldobva; óra-eltérés védelem.
8. **„Hibásnak tűnik?" jelentés** (`news_reports`): `outdated | wrong | spam | other`; ≥ 3 különböző jelentés → automatikus `is_hidden = true`, felülvizsgálatra.
9. **Kapcsoló forrásonként és tételenként** (`enabled`, `is_hidden`) — azonnali visszavonás.
10. Egy kiadó tartalmát **sosem másoljuk át teljes terjedelemben**; csak cím + ≤ 200 kar. kivonat + a feed saját képe + visszalink; „Forrás: {név}" + a szerzői jogi megjegyzés a részletoldalon.

### 18.4 Besorolás (alap-szótár, `supabase/seed/news_keywords.sql` vagy a függvényben; ékezet- és kisbetű-független)

| Téma | Találati szavak (példák) |
|---|---|
| `deals` | akció, akciós, leárazás, kedvezmény, olcsóbb, kupon, hétvégi ajánlat, Tesco, Lidl, Aldi, Spar, Auchan, Penny, CBA, Coop, dm, Rossmann, szórólap |
| `prices` | ár, drágul, olcsóbb lesz, árfigyelő, árrés, infláció, élelmiszer, tej, kenyér, üzemanyag, benzin, gázolaj |
| `utilities` | rezsi, áram, gáz, távhő, víz, villany, energiaár, szolgáltató, áramszámla |
| `banking` | bank, számlavezetés, bankköltség, hitel, kamat, THM, kártya, betét, biztosítás, KGFB, CASCO, kötelező |
| `saving` | megtakarítás, spórol, államkötvény, MÁP, befektetés, tartalék, költségvetés, előfizetés, lemond |
| **deny** | foci, bajnokság, celeb, bulvár, horoszkóp, sztár, válás, botrány, időjárás-előrejelzés, … |

**Pontszám:** `3 × (cím-találat) + 1 × (kivonat-találat) + 2 × (a forrás `topic_hint`-je egyezik)`; küszöb ≥ 3 a „general" forrásoknál. **Személyre szabás:** a feed-lekérdezés a felhasználó kategóriái alapján +2 pontot ad (pl. van `utilities` emlékeztető → rezsi-hírek előrébb) — szerver-oldalon az RPC-ben, **nem** küldünk profilt harmadik félnek.

### 18.5 UI

**`/news`** (külön oldal):
- Fent szűrő-chipek: **Mind · Akciók · Árak · Rezsi · Bank & hitel · Spórolás**.
- Kártya-rács (mobil 1 oszlop, tablet 2, asztal 3): **kép** (16:9, `loading="lazy"`, **`referrerPolicy="no-referrer"`**; hiba/hiány → színátmenetes téma-ikonos tartalék), **cím** (max. 2 sor), **kivonat** (max. 2 sor), meta-sor: **forrás-név** · **FreshnessBadge** · téma-chip. Rendezés: `score` × frissesség.
- Üres állapot: „Most nincs friss hír — nézz vissza később." Hiba: „A hírek most nem érhetők el" (az app többi része működik).
- „Végtelen" lapozás kurzorral `(published_at, id)`; 12 tétel/lap.

**`/news/[id]`** (részletoldal): nagy kép · cím · forrás + **pontos dátum + életkor** · **FreshnessBadge** · kivonat · **[Eredeti cikk megnyitása ↗]** (`target="_blank" rel="noopener noreferrer"`) · akciós figyelmeztetés (18.3/5) · **„Hibásnak tűnik?"** · hasonló tételek · jogi megjegyzés („A tartalom a(z) {forrás} tulajdona; itt csak a címet és rövid kivonatot mutatjuk.").
**Dashboard:** 3 kártyás vízszintes sáv („Hírek"), `news_enabled=false` esetén rejtett.
**Értesítés:** v1-ben a hírek **nem** küldenek push-t. (P2: opcionális heti „Akció-összefoglaló", külön engedéllyel.)

### 18.6 Képek

- A kiadó CDN-jéről **közvetlenül** (hotlink), proxy/optimalizáló nélkül (nem terheljük a Vercel image-kvótát, és nem másoljuk a képet). CSP: `img-src 'self' data: blob: https:`.
- **Tartalék:** ha a kép nem tölt be → `onError` → téma-színátmenet + ikon. **Layout shift** ellen fix `aspect-ratio`.
- Ha egy kiadó kéri a képek kikapcsolását → forrásonkénti `show_images` jelző (P1).

### 18.7 Továbbfejlesztés (P2)

GVH Árfigyelő-adat (engedéllyel), partneri szórólap-adat (strukturált: `store, product, price, unit, valid_from, valid_to, observed_at`), amit **mi** is csak `observed_at`-tal és lejárattal jelenítünk meg; opcionális LLM-es *besorolás* (csak kinyerés/osztályozás, **soha** állítás-generálás, külön döntés).

### 18.8 Elfogadási kritériumok

1. Az első betöltés után ≥ 20 tétel, képekkel (ahol a feed ad képet), forrással, dátummal.
2. Lejárt tétel nem látszik; egy kézzel 8 naposnak állított `deals` tétel **nem** látszik; egy 6 napos **„Lehet, hogy már nem aktuális"** jelzést kap.
3. Jövőbeli `pubDate`-ű teszt-tétel **nem** kerül be.
4. Két forrás ugyanarról a hírről → egy kártya.
5. Egy forrás leállítása (`enabled=false`) azonnal eltünteti a tételeit.
6. Az „akciós" tétel mutatja az ellenőrzés-figyelmeztetést; a „Hibásnak tűnik?" működik.
7. A betöltő hibája (forrás 5xx) nem töri el a többi forrást, és `news_sources.last_error`-ban látszik.

---

## 19. Profil és beállítások (`/profile?section=…`)

> **A gazda kérése:** profil, profilkép állítása, emlékeztető be/ki, sötét/világos mód, angol/magyar váltás. (A ClimarkAI profiloldalának szerkezete — szakaszok az URL-ben, oldalsávban — a minta; a kód nem másolható, H1.)

### 19.1 Szakaszok

| Szakasz (`section`) | Tartalom |
|---|---|
| **overview** (Áttekintés) | **Avatar** (feltöltés/csere/törlés) · megjelenítési név · e-mail (csak olvasható itt) · „tag ezóta" · gyors-statisztika (aktív emlékeztetők száma, ez a havi összeg) |
| **appearance** (Megjelenés) | **Téma:** Világos · Sötét · Rendszer (élő előnézet) · **Nyelv:** Magyar · English · „Kontrasztosabb diagramok" (textúra) · „Kevesebb mozgás" |
| **notifications** (Értesítések) | ⭐ **Fő kapcsoló: „Emlékeztetők be/ki"** (nagy, felül; kikapcsoláskor megerősítő szöveg: „Nem kapsz értesítést a számláidról.") · **Alapértelmezések** új emlékeztetőkhöz: hány nappal előtte (chipek), idő · **Csatornák:** Push, E-mail · **Diszkrét mód** (zárolt képernyőn rejtett részletek) · **Heti összefoglaló** · **Ezen az eszközön:** [Bekapcsolom] + **állapot-diagnosztika** (§12.10) + **Teszt-értesítés** · **Eszközeim** (lista, eltávolítás) · **Naptár-feed** (link másolása, új link) |
| **finance** (Pénzügyek) | Alap-pénznem · időzóna (automatikus + kézi) · **havi jövedelem** (opcionális; csak a tippekhez; „nem osztjuk meg") · **Kategóriáim** (saját kategória: név HU/EN, ikon, színcsoport) |
| **security** (Biztonság) | Jelszó módosítása (régi nélkül, mert friss session; ha a session > 24 órás → újrahitelesítés / e-mail OTP) · E-mail módosítása (megerősítő levéllel) · **Kijelentkezés minden eszközről** |
| **data** (Adataim) | **Adatok letöltése** (JSON + CSV) · **Fiók törlése** (veszélyzóna) |
| **about** (Névjegy) | Verzió · jogi linkek · „nem bank" szöveg · visszajelzés küldése (`mailto:` v1) |

Az aktív szakasz az URL-ben él (`?section=notifications`) — megosztható, oldalfrissítés-biztos. Mobilon a szakaszok listaként, részletre lépéssel; asztalon belső oldalsáv.

### 19.2 Profilkép (F-03) 🔴

```
 koppintás az avatarra → [Fotó kiválasztása | Fotó készítése (mobil) | Törlés]
   → kivágó (négyzet, kör-előnézet, nagyítás/mozgatás)
   → KLIENS: 512×512-re vágás, WebP (q≈0.85) → a canvas eldobja az EXIF-et
   → POST /api/profile/avatar  (multipart)                       ← SZERVER: nem a kliens ír közvetlenül a Storage-ba
       1. session-ellenőrzés (getUser)
       2. méret ≤ 2 MB; magic-byte ellenőrzés (JPEG FF D8 FF · PNG 89 50 4E 47 · WebP "RIFF"…"WEBP")
       3. sharp: 256×256 cover, WebP, **metaadat törlése**
       4. feltöltés a felhasználó JWT-jével: avatars/<uid>/<uuid>.webp  (RLS érvényes)
       5. profiles.avatar_path frissítése; a régi fájl törlése
   → UI azonnal az új képet mutatja (optimista), hiba esetén visszagörget + toast
```
- **Tartalék:** nincs kép → **monogram** (név kezdőbetűi) a `user_id`-ból képzett színcsoporttal (a §15.3 palettából, kontrasztos szöveggel).
- Megjelenítés: `next/image` **nem** kell (256 px-es kis fájl; `<img width height loading="lazy">`); a fájlnév UUID → cache-bust nem kell (új feltöltés = új URL).
- **Tilos:** a kliens által küldött „méret/típus" adatokban megbízni; SVG feltöltés (XSS) — **nem engedett**.

### 19.3 Nyelv- és téma-váltás működése

- **Nyelv:** váltás → `NEXT_LOCALE` süti + `profiles.locale` (Server Action) → `router.refresh()` (nincs teljes újratöltés). A függő értesítések az új nyelven mennek (§12.3).
- **Téma:** `next-themes` azonnal vált (osztály a `<html>`-en); a háttérben `profiles.theme` mentése (debounce). Bejelentkezéskor a profil értéke a localStorage-é elé kerül (egységes élmény eszközök közt).
- **Kijelentkezve** (login oldal): a nyelv/téma a böngésző beállításából indul (Accept-Language / `prefers-color-scheme`), a váltók a login oldalon is elérhetők.

### 19.4 Fiók törlése

Veszélyzóna → szöveges megerősítés („TÖRLÖM" / "DELETE" beírása) → Server Action → Edge Function `delete-account` (JWT-ellenőrzés; avatar-fájlok törlése; `auth.admin.deleteUser(uid)`; a kaszkád törli az összes adatot) → kijelentkeztetés → búcsú-oldal. **Visszavonhatatlan** — a szöveg ezt kimondja.

---

## 20. i18n, téma, formázás

### 20.1 Nyelvkezelés (`next-intl`, előtag nélkül)

- **Feloldás sorrendje:** `profiles.locale` (ha be van lépve) → `NEXT_LOCALE` süti → `Accept-Language` → **`hu`**.
- Üzenetek: `locales/hu.json`, `locales/en.json`; **névterek:** `common · nav · auth · dashboard · reminders · analytics · budgets · savings · tips · news · notifications · profile · install · errors · insights`. Kulcsok: `névtér.szakasz.kulcs` (angol, camelCase).
- **ICU**: többes szám (`{count, plural, one {# nap} other {# nap}}` — a magyar nem különböztet, az angol igen), `select`, számok/dátumok.
- **Tipp-szövegek:** `tips.<code>.title|body|why` (§17), **insight-ok**: `insights.<code>`.
- **Védőkorlátok (B-05):** `npm run i18n:check` — (1) hu/en **kulcs-paritás**, (2) nincs használt, de hiányzó kulcs, (3) lint: nyers szöveg JSX-ben tilos (`react/jsx-no-literals` korlátozottan), (4) CI-ben bukik. A **HU a forrás-igazság** a hangnemhez; az EN nem gépi-fordítás-szagú.
- 🔴 **Nem** használunk futásidejű/LLM-es fordítást (a ClimarkAI megoldásától eltérően) — pénzügyi szövegnél a determinizmus és a sebesség számít.

### 20.2 Téma

`next-themes`: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`; `suppressHydrationWarning` a `<html>`-en. A tokenek (§14.2) CSS-változók `:root` és `.dark` alatt. A `<meta name="color-scheme" content="light dark">`. A diagramok CSS-változókból színeznek (nem hardkódolt hex) → téma-váltáskor újrarenderelés nélkül frissülnek, ahol lehet.

### 20.3 Formázás (`lib/format.ts` — egyetlen forrás)

| Mit | Szabály | Példa HU | Példa EN |
|---|---|---|---|
| Pénz | `Intl.NumberFormat(locale, {style:'currency', currency, maximumFractionDigits: currency==='HUF'?0:2})`; `white-space: nowrap` | `2 300 Ft` | `HUF 2,300` |
| Kompakt (tengely) | `notation:'compact'` | `1,2 M Ft` | `HUF 1.2M` |
| Dátum | `Intl.DateTimeFormat(locale, {dateStyle:'medium'})` a **profil időzónájában** | `2026. nov. 10.` | `10 Nov 2026` |
| Relatív | `Intl.RelativeTimeFormat` + saját „ma/holnap/tegnap" | `holnap` · `3 nap múlva` | `tomorrow` · `in 3 days` |
| Hét eleje | **hétfő** | | |
| Százalék | `Intl.NumberFormat(locale,{style:'percent', maximumFractionDigits:0})` | `31%` | `31%` |

- A „ma" fogalma **mindig a profil időzónájában** értendő (nem a böngészőében, nem UTC) — egy helper: `todayIn(tz)`.
- Az `Intl` kimenet-eltérések (NBSP, keskeny NBSP) teszteléséhez *snapshot helyett* normalizáló segéd a tesztekben.

---

## 21. Szerződés A↔B (RPC-k, Server Actions, route-ok)

> **Ez a fejezet a két AI közti határ.** AI-A *kiszolgálja* (migráció + RPC + Edge Function), AI-B *fogyasztja* (Server Action + UI). A nevek, paraméterek, visszatérési alakok itt rögzítettek (**szerződés v0**). Változtatás → §25 szabálya.
>
> **Elv:** egyszerű CRUD → `supabase.from(tábla)` az RLS mögött; összetett/mellékhatásos/összesítő → **RPC**; háttérmunka → Edge Function (B csak a `send-test-push`-t és a `delete-account`-ot hívja).
> **Típusosság:** az RPC-k lehetőleg `returns table (...)` / `setof` → a generált `database.types.ts` pontos; ahol `jsonb`-t adnak (`dashboard_summary`, `export_my_data`), ott az AI-A a `types/rpc.ts`-ben kézzel karbantartott TS-típust ad. Minden dátum ISO `YYYY-MM-DD`, időbélyeg ISO-8601 UTC, összeg `number` (a PostgREST `numeric`-ot számként adja; **az összegzés mindig SQL-ben történik**, H9).

### 21.1 Közvetlen tábla-hozzáférés (RLS mögött) — B használhatja

| Tábla | Műveletek |
|---|---|
| `profiles` | `select` saját · `update` saját (oszlop-allowlist: `display_name, locale, theme, base_currency, timezone, reminders_enabled, default_offsets, default_notify_time, channel_push, channel_email, notify_hide_details, weekly_digest, tips_enabled, news_enabled, monthly_income, onboarding_done, avatar_path`) |
| `categories` | `select` · `insert/update/delete` (csak saját) |
| `service_catalog` | `select` |
| `reminders` | `select / insert / update / delete` saját — az `insert/update` **trigger** építi az esedékességeket és az értesítési sort |
| `v_occurrences` (nézet, `security_invoker`) | `select` szűrőkkel (`due_date`, `status`, `reminder_id`); sorai: az `occurrences` oszlopai + `reminder_name, category_id, service_slug, is_subscription, amount_base, overdue` |
| `expenses` | `select / insert / update / delete` saját |
| `budgets` | `select / insert / update / delete` saját |
| `savings_goals`, `goal_contributions` | `select / insert / update / delete` saját; `savings_goals_progress` nézet `select` |
| `push_subscriptions` | `select`, `delete` saját (a létrehozás **RPC**-n át) |
| `notifications` | `select` saját `in_app` sorok (`scheduled_for <= now()`); `read_at` frissítés az RPC-n át |
| `tips` | `select` saját |
| `news_reports` | `insert` saját |
| `fx_rates` | `select` |

> **Occurrences** állapotát **csak RPC** módosítja (§9.2).

### 21.2 RPC-k

| RPC | Paraméterek | Visszatérés | Megjegyzés |
|---|---|---|---|
| `preview_dates` | `p_unit text, p_every int, p_start date, p_month_end boolean, p_count int default 4` | `setof date` | az űrlap „Következő: …" előnézete; `immutable` |
| `mark_paid` | `p_occurrence_id uuid, p_paid_amount numeric default null, p_paid_on date default null` | `occurrences` sor | értesítések `cancelled`, árváltozás-jel |
| `mark_unpaid` | `p_occurrence_id uuid` | `occurrences` sor | visszavonás |
| `skip_occurrence` | `p_occurrence_id uuid` | `occurrences` sor | |
| `snooze_occurrence` | `p_occurrence_id uuid, p_until timestamptz` | `occurrences` sor | új értesítést ütemez |
| `dashboard_summary` | `p_month date` | `jsonb` → `DashboardSummary` (`types/rpc.ts`) | hero összeg + Δ, csoportok, következő 5, előfizetés-összesítő, top 3 keret, 1 tipp |
| `analytics_by_group` | `p_from date, p_to date` | `table(group_slot int, group_key text, total numeric, paid numeric, remaining numeric, items int)` | C1 |
| `analytics_monthly_trend` | `p_months int` | `table(month date, paid numeric, remaining numeric)` | C2, sparkline |
| `analytics_cumulative` | `p_month date` | `table(day date, cum_this numeric, cum_prev numeric)` | C3 |
| `analytics_top` | `p_from date, p_to date, p_limit int` | `table(reminder_id uuid, name text, group_slot int, total numeric)` | C4 |
| `analytics_group_trend` | `p_months int` | `table(month date, group_slot int, total numeric)` | C5 |
| `upcoming_days` | `p_days int default 30` | `table(day date, total numeric, items int)` | C6 |
| `analytics_subscriptions` | — | `table(reminder_id uuid, name text, service_slug text, monthly numeric, yearly numeric, share_pct numeric)` | C7 |
| `budget_status` | `p_month date` | `table(budget_id uuid, category_id uuid, monthly_limit numeric, spent numeric, committed numeric, left numeric, state text, forecast numeric, suggested_limit numeric)` | §16.1 |
| `refresh_tips` | — | `int` (érintett sorok) | éjjel a cron is hívja mindenkire (`refresh_tips_all`) |
| `tip_action` | `p_tip_id uuid, p_action text` (`seen\|dismiss\|snooze\|done`) | `tips` sor | |
| `news_feed` | `p_topic text default null, p_limit int default 12, p_before_published timestamptz default null, p_before_id uuid default null` | `table(id, source_key, source_name, url, title, snippet, image_url, topic, published_at, expires_at, freshness text)` | `freshness`: `fresh \| normal \| stale` |
| `register_push_subscription` | `p_endpoint text, p_p256dh text, p_auth text, p_platform text, p_user_agent text, p_label text` | `push_subscriptions` sor | host-allowlist, max. 10 eszköz, upsert `endpoint` szerint |
| `unregister_push_subscription` | `p_endpoint text` | `boolean` | |
| `mark_notifications_read` | `p_ids uuid[] default null` (null = mind) | `int` | |
| `unread_notifications` | — | `int` | 🔔 számláló |
| `export_my_data` | — | `jsonb` | a felhasználó összes adata |
| `rotate_ics_token` | — | `text` (új token) | |
| `ics_feed` | `p_token text` | `table(uid text, due_date date, name text, amount numeric, currency char, offset_days smallint, remind boolean)` | **`anon`-nak engedett**, csak az `/api/ics/[token]` route hívja |

### 21.3 Edge Function-ök

| Név | Hívó | Auth | Kérés → válasz |
|---|---|---|---|
| `send-notifications` | `pg_cron` (`pg_net`) | `x-cron-secret` | — |
| `news-ingest` | `pg_cron` | `x-cron-secret` | — |
| `fx-refresh` | `pg_cron` | `x-cron-secret` | — |
| `send-test-push` | **B** (`supabase.functions.invoke`) | felhasználói JWT | `{}` → `{ ok: boolean, sent: number, devices: number, errors?: string[] }` (rate limit: 3/perc) |
| `delete-account` | **B** | felhasználói JWT | `{ confirm: 'DELETE' }` → `{ ok: true }` |

### 21.4 B oldali Server Action-ök (belső, de névszerinti szerződés a teszteléshez)

`signUp` · `signIn` · `signOut` · `resendConfirmation` · `requestPasswordReset` · `confirmOtp` · `updatePassword` · `updateEmail` · `saveReminder` · `deleteReminder` · `toggleReminderNotify` · `markPaid` · `markUnpaid` · `skipOccurrence` · `snoozeOccurrence` · `createExpense` · `upsertBudget` · `deleteBudget` · `upsertGoal` · `addContribution` · `tipAction` · `updateProfile` · `savePushSubscription` · `removePushSubscription` · `sendTestPush` · `markNotificationsRead` · `exportData` · `deleteAccount` · `reportNews`

### 21.5 B oldali route handler-ek

| Útvonal | Metódus | Cél | Auth |
|---|---|---|---|
| `/api/push/vapid-public-key` | GET | `{ key }` — a SW `pushsubscriptionchange`-hez | publikus |
| `/api/push/resubscribe` | POST | SW-ből: új feliratkozás + régi endpoint törlése | session |
| `/api/occurrences/[id]/paid` | POST | SW értesítés-gomb: „Kifizettem" | session + `Origin` ellenőrzés |
| `/api/occurrences/[id]/snooze` | POST | SW értesítés-gomb: „Holnap emlékeztess" | session + `Origin` |
| `/api/ics/[token]` | GET | `text/calendar` feed (a `.ics` végződés engedett) | token (`ics_feed`) |
| `/api/export` | GET | letölthető export (JSON/CSV) | session |
| `/api/profile/avatar` | POST / DELETE | profilkép (§19.2) | session |
| `/api/health` | GET | `{ ok, version, time }` (DB-t **nem** hívja) | publikus |

### 21.6 Hibaformátum (Server Action-ök és route-ok)

```ts
type ActionState<T = void> =
  | { ok: true; data?: T }
  | { ok: false; code: ErrorCode; message?: string; fieldErrors?: Record<string, string[]> };

type ErrorCode =
  | 'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict'
  | 'rate_limited' | 'limit_reached' | 'upstream_failed' | 'unknown';
```
- A `message` **nem** kerül közvetlenül a UI-ra — a UI a `code` (és `fieldErrors` kulcsok) alapján **lokalizált** szöveget választ.
- A route-ok HTTP-státuszt is adnak (`401/403/404/409/429/500`), a törzs ugyanez az alak.
- Szerveroldali naplóba **nem** kerül e-mail/név/összeg.

### 21.7 Fixture-ök és mockolás (B-t nem blokkoljuk)

- AI-B a `lib/fixtures/*.ts`-ben **típusos mintaadatot** tart (a `database.types.ts` alapján; amíg az nincs kész: az itt leírt DDL alapján kézzel írt ideiglenes típus `types/database.types.ts`-ben **az AI-A első migrációjáig**). A UI-komponensek tiszta, props-ból dolgozó komponensek → a `/dev/ui` játszótéren fixture-rel fejleszthetők.
- AI-A a **`docs/CONTRACT_CHANGES.md`-ben** jelzi, mikor érhető el az első valódi migráció (A-06 kész) → B átáll a valódi adatra.
- **Seed a fejlesztéshez:** `supabase/seed/dev_demo.sql` (A): 1 demó felhasználó 12 emlékeztetővel (Netflix, HBO Max, Prime, Spotify, áram, gáz, internet, telefon, albérlet, hitel, biztosítás, edzőterem), 3 havi `paid` előzménnyel, 5 kerettel, 2 céllal — **csak fejlesztői környezetben futtatható** (kemény ellenőrzés: `current_database()`/projekt-guard; élesre **nem**).

---

## 22. Tesztelés és minőségkapuk

### 22.1 Piramis

| Réteg | Eszköz | Tulaj | Mit fed |
|---|---|---|---|
| SQL egység/integráció | **pgTAP** (`supabase test db`) | A | ismétlődés-vektorok (§8.4), DST-időpontok, sor-építés idempotenciája, `mark_paid` mellékhatások, **RLS** (két felhasználó), minden P0 tipp-szabály, `claim_due_notifications`, budget/analitika-számok, push-endpoint allowlist |
| Edge Function | Deno test (`deno test`) | A | küldő logika (mock push szolgáltatóval: 201/404/410/429/5xx), i18n szövegek, RSS-normalizálás (fixture-feed), idő-szűrők |
| Egység (TS) | **Vitest** (+ Testing Library) | B | `applyPersistence`, `safeNext`, `detectInstallState`, `format`, zod-sémák, komponensek (BillRow, BudgetBar, TipCard, FreshnessBadge), `PushResult` → üzenet |
| Végpont-végpont | **Playwright** | B | regisztráció → e-mail (teszt-felhasználó admin-létrehozással) → belépés; emlékeztető felvétele (J3); kifizettem + visszavonás; téma/nyelv váltás; profilkép; analitika-oldal betöltése; install-gomb állapotok (mockolt `beforeinstallprompt`); 360 px és 1280 px nézet |
| Hozzáférhetőség | **axe** (Playwright) | B | minden fő oldal: 0 *serious/critical* |
| Kézi eszköz-teszt | ellenőrzőlista | AB (gazda) | §22.3 |

### 22.2 Minőségkapuk (egy feladat sem „kész", amíg ezek nem zöldek)

**B:** `npm run typecheck` (0 hiba) · `npm run lint` · `npm run i18n:check` · `npm test` · `npm run build` (a „zöld tsc ≠ működő build" tanulsága, H11) · releváns Playwright-teszt · a11y.
**A:** `npm run db:assert` · `npm run db:test` (pgTAP zöld) · Edge Function `deno check` + `deno test` · **RLS-teszt zöld** · `supabase db lint` (ha elérhető) · a migráció *idempotens újra-futtatása* helyi DB-n (ha van).
**Mindkettő:** minden *tartós szabályhoz guard-teszt*, amit **mutációval ellenőrzöl** (szándékosan rontsd el a kódot → a teszt bukjon).

**CI (GitHub Actions, javasolt):** `install` → `typecheck` → `lint` → `i18n:check` → `test` → `build` → (ha van Docker) `supabase start` + `db:test` + Playwright. Titkot a CI csak titok-tárolóból kap (H3); a prod projekt **kulcsait nem adjuk a CI-nak**.

### 22.3 Kézi eszköz-mátrix (a gazda + AI közös ellenőrzőlistája, a `docs/STATUS.md`-ben pipálva)

| Eszköz | Böngésző/mód | Ellenőrzendő |
|---|---|---|
| Android telefon | Chrome (böngészőben + telepítve) | Letöltés gomb, push (ütemezett + teszt), „Kifizettem" gomb az értesítésben, app-jelvény |
| **iPhone** (iOS ≥ 16.4) | Safari → **Kezdőképernyőre téve** | iOS-útmutató, engedélykérés gesztusra, push megérkezik, koppintás → mély link |
| iPad | Safari → Kezdőképernyő | mint iPhone, tablet-elrendezés |
| Windows laptop/PC | Chrome / Edge (telepítve + böngészőben) | telepítés, push, ablakos app, kijelentkezett állapotban push-szöveg |
| Windows | **Brave** (a gazda böngészője) | a push-hibaüzenet + a „Use Google services for push messaging" út; utána működik |
| macOS | Safari + Chrome | Safari „Hozzáadás a Dockhoz", push |
| Sötét mód / nagy betű / 200% nagyítás | mind | nincs levágott szöveg, kontraszt rendben |
| Offline (repülő mód) | telepített app | `offline.html`, nincs fehér képernyő |
| Lassú hálózat (3G-szimuláció) | Chrome DevTools | skeleton-ok, nincs elugrás |

### 22.4 Teljesítmény-célok (irányadó)

- Dashboard: **LCP ≤ 2.5 s** (4G, közepes telefon); első betöltési JS ≤ ~200 kB gzip; a diagramok *lazy*.
- `dashboard_summary` ≤ 150 ms (1 000 esedékesség mellett) — **index-terv** a migrációban (§8.3), `EXPLAIN` a PR-ben.
- Egy oldal ≤ 3 adatbázis-kérés (RPC-kkel összevonva); nincs N+1.

### 22.5 Megfigyelhetőség

Vercel + Supabase logok; `/api/health`; **üzemeltetési nézet** `ops_health` (A, csak `service_role`): utolsó cron-futások (`cron.job_run_details`), beragadt `sending`/`failed` sorok száma, `news_sources.last_status`, halott feliratkozások aránya. Hibák: `error.tsx` + szerver-log (PII nélkül). Külső hibakövető (Sentry) **P2** és csak PII-mentesen.

---

## 23. Deploy, környezetek, üzemeltetés

### 23.1 Környezetek

| Környezet | Frontend | Backend | Megjegyzés |
|---|---|---|---|
| **Helyi** | `npm run dev` (localhost:3000) | **helyi Supabase (Docker)** *ha van* — különben a gazda által jóváhagyott egyetlen projekt, **fokozott óvatossággal (H5)** | §26-Q3 |
| **Éles** | Vercel (`main` ág) | Supabase `ddvzslgwexvdolovqqlg` | egyetlen projekt |
| (opcionális) **Dev** | Vercel preview | második ingyenes Supabase projekt (`bank_reminder_dev`) | ajánlott, a gazda dönt |

### 23.2 Vercel beállítás (B-27)

Projekt import → Framework: Next.js · Node 22 · **Régió**: `arn1`/`fra1` · env változók (Függelék A) *Production + Preview*-ra külön · `NEXT_PUBLIC_SITE_URL` = élesen a végleges domain · Domain + HTTPS · *Preview* deploy-ok jelszóvédettek (hogy ne legyenek publikus, valós adatot elérő másolatok) · **`sw.js` fejléc**: `Cache-Control: no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /`.
> A Vercel **Hobby** csomag *személyes, nem kereskedelmi* használatra való; ha az app üzleti termékké válik → Pro (§26-R4).

### 23.3 Supabase beállítás (A-03 … A-05, A-18) — sorrend

1. `supabase login` (a gazda) → `supabase link --project-ref ddvzslgwexvdolovqqlg` — **előtte `db:assert`** (H2).
2. Migrációk helyben tesztelve → **gazdai jóváhagyás** → `npm run db:push`.
3. Kiterjesztések (pg_cron, pg_net) + **Vault**: `CRON_SECRET` létrehozása *egyszer, kézzel*.
4. **VAPID kulcspár**: `npm run gen:vapid` → publikus kulcs → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Vercel + `.env.local`); **privát** kulcs + `VAPID_SUBJECT` (`mailto:…`) → `supabase secrets set` (soha fájlba).
5. SMTP/e-mail szolgáltató titkai → `supabase secrets set` + Auth SMTP beállítás.
6. Storage bucket + policy (migráció).
7. Edge Function-ök deploy (`fn:deploy`), majd a **cron-ütemezések létrehozása** (külön migráció, ami a függvények *létezését* feltételezi).
8. Auth-beállítások és e-mail sablonok (§10.5, §11).
9. Seed: kategóriák, katalógus, hírforrások, kulcsszavak, tip-küszöbök.
10. Dim-teszt: „1 perc múlva" értesítés egy valódi eszközre.

### 23.4 Kiadási folyamat

- **Expand → migrate → contract:** a migráció mindig visszafelé-kompatibilis az éppen futó frontenddel; először DB (`db:push`), utána app-deploy. Oszlop-törlés/átnevezés külön, későbbi lépésben.
- **Visszagörgetés:** frontend — Vercel azonnali rollback; DB — *előre-javítás* (új migráció), nem lefelé-migráció.
- **Verzió:** semver a `package.json`-ban; a `Profil → Névjegy` mutatja; `CHANGELOG.md` (B).

### 23.5 Mentés / helyreállítás

A **Free** csomagon nincs automatikus mentés → (1) a gazda időnként (havonta) `pg_dump`-ot készít helyben a DB-kapcsolati stringgel (**titok, nem a repóban**); (2) felhasználónként elérhető az **adat-export** (F-25); (3) éles felhasználók előtt **Pro** (napi mentés) vagy ütemezett külső mentés. A `docs/`-ban rövid `RESTORE.md` (A) — hogyan állítható vissza.

### 23.6 Üzemeltetési ellenőrzőlista (hetente, a gazdának)

☐ Utolsó cron-futások rendben (`ops_health`) · ☐ Nincs beragadt `sending/failed` sor · ☐ Hírforrások `last_status = 200` · ☐ A Supabase projekt **nincs szüneteltetve** · ☐ E-mail kézbesíthetőség (DMARC-riport) · ☐ `npm audit` · ☐ A VAPID/SMTP kulcsok érvényesek.

### 23.7 Költségek (indulás)

Supabase Free · Vercel Hobby · SMTP-szolgáltató ingyenes sávja (ellenőrizd az aktuális csomagot) · domain (~éves díj) → **≈ 0 Ft + domain**. Pro-ra váltás indokai: nincs szüneteltetés, napi mentés, magasabb limitek.

---

## 24. Mérföldkövek és feladatlista

> **Munkamegosztás röviden**
> - **AI-A (Platform):** minden, ami a Supabase-ben él — séma, RLS, RPC, Edge Function, cron, e-mail sablonok, hírbetöltő, tippek-SQL, adat-tesztek, üzemeltetés.
> - **AI-B (Experience):** minden, ami a böngészőben/telefonon él — Next.js app, UI, PWA, service worker, push-kliens, i18n, téma, diagramok, E2E.
> - **Méret:** `S` (≤ 1 óra) · `M` (1–3 óra) · `L` (3–8 óra) · `XL` (több munkamenet).
> - A feladatok **sorrendben** haladnak a mérföldkövön belül; a „Függ." a másik AI szállítmányát jelöli.

### 24.1 Szinkron-pontok (a két AI itt találkozik)

| Sync | Feltétel (mitől „zöld") | A szállít | B szállít | Közös teszt |
|---|---|---|---|---|
| **S0** | a repo-alapok készen | A-01, A-02, A-03 | B-01 | `npm run dev` fut; `db:assert` zöld |
| **S1** | **Belépés végigvihető** valódi e-maillel | A-04, A-05, A-06, A-09, A-14 | B-04, B-07, B-08, B-27 (deploy) | J1/J2/J8: regisztráció → személyre szabott levél → megerősítés → belépés → profil |
| **S2** | **A „Netflix"-forgatókönyv** (J3) | A-07, A-10 | B-10…B-14 | emlékeztető felvétele → esedékességek → kifizettem → dashboard-számok |
| **S3** | **Értesítések valódi eszközökön** | A-12, A-13, A-15…A-18, A-20 | B-16…B-19 | §12.14 + §13.7 + §22.3 (Android, iPhone, Windows) |
| **S4** | Analitika, keretek, célok, naptár | A-11, A-19 | B-15, B-20…B-23 | §15, §16 számok egyeznek a kézi számítással |
| **S5** | Tippek | A-21, A-22 | B-24 | a 17.4 forgatókönyv |
| **S6** | Hírek | A-23…A-25 | B-25 | §18.8 |
| **S7** | Kiadás-jelölt | A-26…A-30 | B-26, B-28…B-32 | teljes kézi mátrix (§22.3), `npm run build` zöld, biztonsági átnézés |

> **MVP-vágás:** **S0–S3 + az Analitika alapjai (C1–C3) = első használható kiadás.** A többi (keretek, célok, tippek, hírek) rétegesen jön, nem blokkolja az első ténylegesen használható verziót.

### 24.2 AI-A feladatok (Platform)

| ID | Mk. | Feladat | Kimenet | Elfogadási kritérium | Méret | Függ. |
|---|---|---|---|---|---|---|
| **A-01** | M0 | Repo-higiénia | `git init`, `.gitignore` (`.env*`, `supabase/.temp`, `.next`, `node_modules`), `.gitattributes` (`eol=lf`), `.env.example`, **titok-szkenner pre-commit** (gitleaks vagy minta-szkript), `docs/STATUS.md`, `CONTRACT_CHANGES.md`, `DECISIONS.md` sablonok | titkot tartalmazó teszt-commit **bukik**; a sablonok léteznek | S | — |
| **A-02** | M0 | **Projekt-védő** szkript | `scripts/assert-project.mjs`, `npm run db:assert` | rossz projekt-ref → nem-nulla kilépés + érthető hiba; jó ref → 0 | S | A-01 |
| **A-03** | M0 | Supabase CLI-init + link | `supabase/config.toml`, (ha van Docker) helyi stack indul | `db:assert` után `supabase link` rendben; **a gazda jóváhagyását dokumentálva** | S | A-02 |
| **A-04** | M1 | **Auth-beállítások végrehajtása** a gazdával (Dashboard) | a §10.5 táblázat kipipálva a `STATUS.md`-ben (+ SMTP-döntés §26-Q2) | tesztlevél megérkezik **nem csapattag** címre is | M | A-03, Q2 |
| **A-05** | M1 | **E-mail sablonok** (§11) | `supabase/email-templates/*.html`, beillesztve a Dashboardra | §11.5 mind a 7 pont ✔ (HU/EN, név nélküli eset, tárgy) | M | A-04 |
| **A-06** | M1 | **Core séma + RLS** (§8, §9) | `migrations/0001_core.sql`: profiles + `handle_new_user`, categories, service_catalog, reminders, occurrences, expenses, budgets, savings_goals, goal_contributions, push_subscriptions, notifications, fx_rates, tips, news_*; **minden táblán RLS**; `avatars` bucket + policy | `db push` (jóváhagyással) lefut; regisztráció létrehozza a profilt; B tud írni/olvasni saját adatot | L | A-03 |
| **A-07** | M2 | **Ismétlődés + esedékesség + RPC-k** | `occurrence_dates`, `preview_dates`, `ensure_occurrences`, reminder-triggerek, `mark_paid/unpaid`, `skip_occurrence`, `snooze_occurrence`, `v_occurrences` | **pgTAP: V1–V7 vektorok zöldek**; J3 forgatókönyv sorai helyesek; idempotens újrafuttatás | L | A-06 |
| **A-08** | M1→M5 | **Seed-ek** | `seed/categories.sql` (Függ. C) · `service_catalog.sql` (**csak ellenőrzött adat, `verified_at`**) · `news_sources.sql` · `news_keywords` · `tip_config.sql` | a kategóriák HU+EN; a katalógus-sorokhoz van forrás; nincs kitalált ár | M | A-06 |
| **A-09** | M1 | **Típus-generálás** + `types/rpc.ts` váz | `npm run db:types`; `types/database.types.ts`; `DashboardSummary` stb. interfészek | B importálja, `tsc` 0 hiba | S | A-06 |
| **A-10** | M2 | **Analitika-RPC-k** + `fx_convert` | `dashboard_summary`, `analytics_*`, `upcoming_days`, `analytics_subscriptions` | pgTAP: a §15.2 definíciók szerinti számok kézzel ellenőrzött fixture-ön; hiányzó árfolyam → jelzés, nem 0 | L | A-07 |
| **A-11** | M4 | **Keret- és cél-logika** | `budget_status`, `savings_goals_progress` | pgTAP: ok/watch/over állapotok, forecast, suggested_limit | M | A-10 |
| **A-12** | M3 | **Értesítési sor-építő** | `rebuild_notification_queue`, `enqueue_extra_notifications` (overdue/trial/digest), `claim_due_notifications`, kapcsoló-ellenőrzés a claim-ben | **pgTAP: §8.4 DST-vektorok**, dedupe, 24 órás elavulás, `mark_paid` → cancel, `p_now` paraméter | XL | A-07 |
| **A-13** | M3 | **Push-/ICS-/export-RPC-k** | `register_push_subscription` (host-allowlist, max. 10 eszköz), `unregister_…`, `mark_notifications_read`, `unread_notifications`, `export_my_data`, `rotate_ics_token`, `ics_feed` | pgTAP: tiltott host elutasítva; ICS csak a token tulajdonosáét adja | M | A-06 |
| **A-14** | M1 | **RLS-teszt-csomag + lint** | pgTAP „két felhasználó" teszt minden táblára; ellenőrzés: *minden `public` táblán RLS be van kapcsolva*; `security definer` függvények `search_path`-ja üres | a tesztek mutációra buknak (RLS-t kikapcsolva piros) | M | A-06 |
| **A-15** | M3 | **Edge `_shared`** | `auth.ts` (cron-titok konstans idejű ellenőrzés, JWT), `supabase.ts`, `log.ts` (PII-mentes), `i18n.ts` (§12.3 szótár HU/EN), `email.ts` | `deno check` + egységtesztek | M | A-03 |
| **A-16** | M3 | **`send-notifications`** | push + e-mail küldés, hibakezelés (§12.11), diszkrét mód, nyelv | Deno-tesztek mock push szolgáltatóval: 201/404/410/429/5xx; §12.14 pontjai | XL | A-12, A-15, A-20 |
| **A-17** | M3 | **`send-test-push`, `delete-account`** | két függvény | teszt: 3/perc limit; törlés után nincs maradék adat/avatar | M | A-15 |
| **A-18** | M3 | **Vault + cron + VAPID-runbook** | `CRON_SECRET` a Vaultban (kézi lépés dokumentálva), `migrations/00xx_cron.sql` (§6.3 összes job), `npm run gen:vapid`, `docs/RUNBOOK-secrets.md` | a `cron.job` listában minden job; egy teszt-sor 1–2 percen belül kiküldve | M | A-16 |
| **A-19** | M4 | **`fx-refresh`** | Edge + cron | `fx_rates` naponta frissül; hibánál nem töri a többit | S | A-15 |
| **A-20** | M3 (elöl) | **Push-könyvtár spike** | `DECISIONS.md` bejegyzés: `@negrel/webpush` vs `npm:web-push` (futás Supabase Edge-en, iOS/Android/Chrome/Firefox/Safari kézbesítés, méret/hiba) | egy működő PoC valódi böngészőre; döntés indoklással | M | A-03 |
| **A-21** | M5 | **Tippek P0-szabályok** | `refresh_tips`, `refresh_tips_all`, `tip_action`, `tip_config` | pgTAP minden P0 szabályra (+negatív) + §17.4 forgatókönyv | L | A-07, A-08 |
| **A-22** | M5 | **Tippek P1-szabályok** | a katalógus P1 sorai | pgTAP | M | A-21 |
| **A-23** | M6 | **`news-ingest`** | §18.2 folyamat teljesen | Deno-tesztek fixture-feeddel: duplikátum, jövőbeli dátum, régi, HTML-tisztítás, besorolás, lejárat | L | A-15, A-08 |
| **A-24** | M6 | **Hírforrások élő ellenőrzése** | minden forrás újra-tesztelve; „ellenőrizendő" mezők kitöltve; jogi megjegyzés-oszlop; a kiadók feltételeinek rövid összegzése a `DECISIONS.md`-ben | a gazda jóváhagyja a végleges listát (§26-Q6) | M | A-23 |
| **A-25** | M6 | **`news_feed` RPC + auto-elrejtés** | `news_feed`, `news_reports` trigger (≥ 3 jelentés → `is_hidden`) | pgTAP | S | A-06 |
| **A-26** | M7 | **Üzemeltetés** | `ops_health`, `cleanup_daily`, `RESTORE.md`, mentési útmutató | a nézet fut, a takarítás tesztelt | M | A-18 |
| **A-27** | M7 | **Heti digest + próbaidő/lejárt sorok finomítása** | `enqueue_extra_notifications` kiegészítések | pgTAP + valós eszközön 1 digest | M | A-12 |
| **A-28** | M7 | **Teljesítmény + advisor-ok** | `EXPLAIN` a fő RPC-kre, hiányzó indexek; Supabase security/perf advisor-ok átnézve | nincs *HIGH* advisor-találat; `dashboard_summary` ≤ 150 ms | M | A-10 |
| **A-29** | M7 | **Biztonsági átnézés** (§9.6) | ellenőrzőlista kipipálva a `STATUS.md`-ben: RLS, definer, Edge-auth, SSRF, titkok, logok | nincs nyitott *kritikus* pont | M | mind |
| **A-30** | M2→ | **Fejlesztői demó-seed** + B támogatása | `seed/dev_demo.sql` (projekt-guarddal) | B látja a 12 tételes demót a UI-ban | S | A-07 |

### 24.3 AI-B feladatok (Experience)

| ID | Mk. | Feladat | Kimenet | Elfogadási kritérium | Méret | Függ. |
|---|---|---|---|---|---|---|
| **B-01** | M0 | **Scaffold** | Next 16 + TS strict + Tailwind 4 + shadcn alap, `eslint`, `vitest`, `playwright`, npm szkriptek (§7.4), `utils/supabase/{client,server,middleware}.ts` a gazda útmutatója szerint, `lib/brand.ts`, `README.md`; **`.env.local` helyben** a publikus URL+publishable kulccsal (nem commitolva) | `npm run dev/typecheck/lint/test/build` zöld | M | A-01 |
| **B-02** | M0 | **Tokenek + shell + játszótér** | `globals.css` tokenek (§14.2) világos/sötét, Inter (`latin-ext`!), `next-themes`, `AppShell` (alsó fül-sáv / ikon-sín / oldalsáv), `/dev/ui` | a shell 360/768/1280 px-en helyes; téma-váltás villódzás nélkül | L | B-01 |
| **B-03** | M0 | **i18n alap + formázó** | `next-intl` (előtag nélkül), `locales/hu|en.json` váz, `lib/format.ts` (§20.3), `todayIn(tz)` | a formázó tesztek (HU/EN, HUF/EUR) zöldek | M | B-01 |
| **B-04** | M1 | **`proxy.ts` + védett útvonalak** | `proxy.ts`, `updateSession`, `lib/auth/persist.ts`, `safeNext`, publikus lista (§10.6) | védett oldal kijelentkezve → `/login?next=…`; `/api/*` → 401 JSON | M | B-01 |
| **B-05** | M1 | **`i18n:check`** | szkript + CI-lépés (kulcs-paritás, hiányzó kulcs, nyers JSX-szöveg lint) | hiányzó EN kulcsra a szkript **bukik** | S | B-03 |
| **B-06** | M1 | **Kontraszt-teszt a tokenekre** | vitest: minden szöveg/háttér pár ≥ 4.5:1 (nagy: ≥ 3:1) világos+sötét | a teszt mutációra (rossz szín) bukik | S | B-02 |
| **B-07** | M1 | **Auth oldalak + Server Action-ök** | `/login /signup /check-email /forgot-password /reset-password /auth/confirm`, jelszó-erősség, „Maradjak bejelentkezve", hibaleképezés (§10.8), újraküldés 60 mp-cel | J1/J2/J8 végigvihető valódi levéllel; a hibák általánosak | L | B-04, A-05, A-06 |
| **B-08** | M1 | **Profil I.: shell + Áttekintés + Megjelenés** | `/profile?section=…`, **avatar-feltöltő** (§19.2: vágás, WebP, `/api/profile/avatar`, magic-byte, sharp), téma/nyelv váltó + profil-szinkron | avatar csere működik, EXIF nincs a fájlban, rossz típus elutasítva | L | B-07, A-06 |
| **B-09** | M1 | **Guard-tesztek** | `applyPersistence` (4 eset), `safeNext` (támadó bemenetek), `mapAuthError` | mutációra bukó tesztek | S | B-04 |
| **B-10** | M2 | **Alap-komponensek + fixture-ök** | `BillRow`, `AmountText`, `CategoryChip/Icon`, `EmptyState`, `Skeleton*`, `BottomSheet`, `ConfirmDialog`, Toast+Visszavonás, `PayButton` | a `/dev/ui`-n minden állapot (üres, betöltés, hiba, lejárt) | M | B-02 |
| **B-11** | M2 | **Emlékeztető-lista** | `/reminders` (csoportok, szűrők, keresés, 🔔 kapcsoló, üres állapot) | valós adaton (A-30 seed) helyes csoportosítás | M | B-10, A-07 |
| **B-12** | M2 | **Emlékeztető-űrlap** | `ServicePicker`, `RecurrencePicker`, `OffsetChips`, `preview_dates` előnézet, zod-séma, létrehozás/szerkesztés/törlés | **J3 végigvihető ≤ 60 mp alatt**; a §14.6 tiltások érvényesek | L | B-10, A-07 |
| **B-13** | M2 | **Részletek + esedékesség-műveletek** | `/reminders/[id]`, kifizettem/visszavonás/kihagy/halaszt (optimista + Visszavonás), árelőzmény | a művelet után az értesítések `cancelled` (A-oldalon ellenőrizve) | M | B-12 |
| **B-14** | M2 | **Dashboard** | hero + fánk (C1 egyszerűsítve), „Hamarosan esedékes", előfizetés-sáv, (tipp/hír/keret helyőrzők) a `dashboard_summary`-ból | számok = A-10 tesztfixture; LCP-cél (§22.4) | L | B-10, A-10 |
| **B-15** | M4 | **Naptár + ICS-felület** | `/calendar`, naptár-link másolás/forgatás | a link naptár-appban megnyitható | M | A-13 |
| **B-16** | M3 | **PWA-alap** | `public/sw.js` (§12.5/13.4), regisztráció + frissítés-toast, `public/offline.html`, `app/manifest.ts`, `gen:icons`, `<head>` meta | §13.7 1., 5., 6., 7. pont | L | B-02 |
| **B-17** | M3 | **InstallButton + `/install`** | állapotgép (`detectInstallState`), iOS-útmutató, QR, `appinstalled` | §13.7 2–4. pont valós eszközön; vitest minden állapot-ágra | L | B-16 |
| **B-18** | M3 | **Push-kliens** | `enablePush`, `PushToggle`, `PushDiagnostics`, eszközlista, teszt-gomb, hibaüzenetek (§12.9) | valós Android/iPhone/Windows teszt-értesítés; Brave-hint | L | B-16, A-13, A-17 |
| **B-19** | M3 | **Értesítésközpont + jelvény** | 🔔, `/notifications`, olvasottság, app-jelvény | push után a lista frissül; jelvény-szám helyes | M | B-18, A-13 |
| **B-20** | M4 | **Diagram-csomag** | `components/charts/*` (Donut, TrendBars, CumulativeLine, TopBars, Sparkline, ChartTable), validált színek, tooltip, jelmagyarázat, táblázat-nézet, lazy | §15.5 mind; hover+billentyűzet; sötét mód | XL | B-10, A-10 |
| **B-21** | M4 | **Analitika-oldal** | `/analytics` C1–C7, KPI-k, meglátások | a számok egyeznek a kézi számítással (§15.2) | L | B-20 |
| **B-22** | M4 | **Keretek + gyors kiadás** | `/budgets`, `BudgetBar`, gyors-kiadás lap, javasolt keret | piros túllépés + ikon + szöveg; ref-4 hűség | L | B-20, A-11 |
| **B-23** | M4 | **Megtakarítási célok** | `/savings`, `GoalCard`, hozzájárulás/kivét, előkészített célok | ref-2 hűség | M | A-11 |
| **B-24** | M5 | **Tippek-oldal** | `/tips`, `TipCard`, „Miért látom", usage-tags választó, tip-szövegek HU/EN | 17.4 forgatókönyv a UI-ban végigvihető | L | A-21 |
| **B-25** | M6 | **Hírek** | `/news`, `/news/[id]`, `NewsCard`, `FreshnessBadge`, jelentés-gomb, dashboard-sáv | §18.8 UI-pontjai | L | A-25 |
| **B-26** | M7 | **Onboarding + manifest-képernyőképek** | `/onboarding` (3 lépés), `screenshots` a manifestben | új felhasználó ≤ 60 mp alatt az első emlékeztetőig | M | B-12, B-18 |
| **B-27** | **M1** | **Vercel-deploy + biztonsági fejlécek** | projekt, env, régió, domain, CSP/HSTS/… (§9.6), `sw.js` fejlécek | HTTPS-en elérhető; a fejléc-ellenőrző zöld; preview védett | M | B-01 |
| **B-28** | M7 | **Profil II.** | Értesítések, Pénzügyek, Biztonság, Adataim (export + törlés), Névjegy | §19.1 mind; törlés végigvihető | L | B-08, A-13, A-17 |
| **B-29** | M7 | **A11y-átfutás** | `axe` minden fő oldalra, billentyűzet, fókusz, `aria-live`, VoiceOver/TalkBack kör, „kontrasztosabb diagramok" opció | 0 *serious/critical* axe-hiba | M | mind |
| **B-30** | M7 | **E2E-csomag** | Playwright: J1–J4, téma/nyelv, avatar, install-gomb állapotok, 360/1280 px | CI-ben zöld | L | S1–S3 |
| **B-31** | M7 | **Finomítás** | microcopy HU/EN átnézés, üres/hiba/404 oldalak, bundle-elemzés, animációk, `CHANGELOG.md` | §22.4 célok | M | mind |
| **B-32** | **M1** | **Jogi oldal-helyőrzők** | `/privacy`, `/terms` (HU/EN, „TERVEZET" jelzéssel), a regisztráció jelölőnégyzete linkel | a szöveget a gazda adja (§26-Q7) | S | B-02 |

### 24.4 Mérföldkő-összefoglaló (párhuzamosság)

```
        M0           M1                 M2               M3                    M4                M5      M6      M7
AI-A  A-01..03 → A-04,05,06,09,14,(08) → A-07,10,30 → A-20,12,13,15,16,17,18 → A-11,19 ──────→ A-21,22 → A-23..25 → A-26..29
AI-B  B-01..03 → B-04,05,06,07,08,09,    B-10..14        B-16,17,18,19          B-15,20,21,22,23   B-24    B-25     B-26,28..31
                 27(deploy),32
                       ▲ S1                  ▲ S2              ▲ S3 (értesítés valódi eszközön)    ▲ S4    ▲ S5    ▲ S6   ▲ S7
```
Amíg A a következő szállítmányon dolgozik, **B nem vár**: fixture-ökkel/játszótéren halad (§21.7). Amíg B a UI-t építi, **A nem vár**: a következő backend-réteget építi pgTAP-pal.

---

## 25. Együttműködési protokoll a két AI között

### 25.1 Munkakörnyezet

- **Verziókezelés:** `git init` (A-01). Ágak: `main` (csak zöld kapukkal), `ai-a/<téma>`, `ai-b/<téma>`.
- **Javasolt:** *külön munkafa* mindkét AI-nak, hogy ne zavarják egymást:
  `git worktree add ../Bank_Reminder-A -b ai-a/work` és `git worktree add ../Bank_Reminder-B -b ai-b/work` — **a worktree-k is a `D:\Projectss\` alatt**, sosem a ClimarkAI mappa közelében (H1).
- Ha ugyanabban a mappában dolgoznak: **csak a saját könyvtáraidba írj** (§7.2); gyakori, kis commitok.
- **Commit-üzenet:** `[A] A-06: core séma + RLS` / `[B] B-12: emlékeztető-űrlap`. **Soha** `git add .` vakon (titok-kockázat) — explicit útvonalak; commit előtt `git status` + `git diff --staged`. Nincs `--force`, nincs `--no-verify`.
- Merge `main`-be: a **kapuk zöldek** (§22.2) + a másik AI *átfutotta* a határ-érintő részt (§25.5).

### 25.2 Közös dokumentumok (mindkét AI olvassa, **mindig** a munkamenet elején)

**`docs/STATUS.md`** — sablon:

```md
# STATUS  (legújabb fent)
## 2026-10-14 · AI-A · M1
- ✔ A-06 kész (commit abc123) — táblák: …; B már használhatja.
- ⏳ A-05 folyamatban — a Dashboard-beillesztésre vár (gazda).
- ⛔ Blokkol: A-04 → SMTP-döntés (Q2).
- Kérdések a gazdának: (ld. lent)
## Kérdések a gazdának (összegyűjtve — ne kérdezz többször ugyanarról)
- Q2 …
## Kézi ellenőrzések (§22.3)  ☐ Android ☐ iPhone ☐ Windows/Chrome ☐ Brave ☐ …
```

**`docs/CONTRACT_CHANGES.md`** — minden szerződés-változás (táblák, RPC-k, route-ok, push-formátum):

```md
## [YYYY-MM-DD] <rövid cím>   — javasolta: AI-A|AI-B   — státusz: proposed|accepted|done|rejected
- Mi változik: …           - Miért: …
- Törő változás?: igen/nem (ha igen: átmeneti kompatibilitás + határidő)
- A másik AI teendője: …   - Érintett: §8 / §21 / §12.6 …
```

**`docs/DECISIONS.md`** — ADR-lite: dátum · döntés · alternatívák · indok · ki döntött (AI vagy gazda).

### 25.3 Szerződés-változtatás folyamata

1. **Ne változtasd egyoldalúan** a §8/§21 szerződést. Előbb bejegyzés a `CONTRACT_CHANGES.md`-be (`proposed`).
2. A másik AI a következő munkamenetében elfogadja/elutasítja (indoklással) a `STATUS.md`-ben.
3. **Törő** változásnál *expand → migrate → contract*: előbb az új alak mellett a régi is működik; csak a másik oldal átállása után törlünk.
4. A `ARCHITECTURE.md`-t a változás elfogadása után pontosítja a javaslattevő (verziószám: `v0.x`).
5. **Nincs válasz?** Folytasd a *visszafelé kompatibilis* úton, jelöld a `STATUS.md`-ben, és kérdezd meg a gazdát. **Vitát a gazda dönt el.**

### 25.4 Munkamenet-rutin

- **Indításkor:** olvasd el §2 (Kemény szabályok) → `STATUS.md` → `CONTRACT_CHANGES.md` → a következő saját feladat a §24-ből.
- **Közben:** egyszerre egy feladat; a kapukat (§22.2) a feladat végén futtasd; ne hagyj „majd később" TODO-t nyomtalanul — a `STATUS.md`-be írd.
- **Zárásként:** `STATUS.md` frissítve (kész/folyamatban/blokkol), commit, a következő lépés 1 mondatban.

### 25.5 Kereszt-átnézés (a határnál)

- **B átnézi A-t:** az RPC-k használhatósága (névvel, paraméterrel, hibákkal), a típusok pontossága, a fixture-ök reálisak-e.
- **A átnézi B-t:** *adat-hozzáférés*: nincs `select('*')` ott, ahol szűkebb is elég; nincs titok a kliensben; Server Action-ök nem bíznak a kliens `user_id`-jában; a SW cache-szabály (§13.4); a push-payload nem tartalmaz érzékeny adatot diszkrét módban.
- Mindkettő: `/code-review` jellegű önátnézés a saját diffre a merge előtt.

### 25.6 „Kész" definíciója (általános)

☐ A feladat elfogadási kritériuma teljesül · ☐ kapuk zöldek (§22.2) · ☐ HU **és** EN szövegek · ☐ RLS/jogosultság áttekintve (ha adat-érintő) · ☐ a11y-alapok (billentyűzet, fókusz, kontraszt) · ☐ nincs titok a diffben · ☐ `STATUS.md` frissítve · ☐ a szerződés-változás bejegyezve · ☐ a tartós szabályhoz van guard-teszt.

### 25.7 Amit **ne** csinálj

- Ne építs **P2**-t, amíg a P0/P1 nincs kész; ne bővítsd a funkciókört kérdés nélkül („extra" ötlet → `DECISIONS.md` javaslat).
- Ne adj hozzá új függőséget indoklás nélkül (méret, karbantartottság, licenc) — a `DECISIONS.md`-be egy sor.
- Ne írj a ClimarkAI mappába, ne használd a ClimarkAI Supabase-ét (H1/H2) — **még „csak egy gyors teszt"-hez sem**.
- Ne írd ki a titkokat (jelszó, `sb_secret_…`, VAPID privát) sehova.
- Ne „javítsd meg" a másik AI könyvtárát — jelezd a `STATUS.md`-ben/`CONTRACT_CHANGES.md`-ben.
- Ne ments olyat a Storage-ba/DB-be, amit a H10/§9.4 tilt (banki hitelesítő adat, kártyaszám).

---

## 26. Kockázatok és nyitott kérdések

### 26.1 Kockázatok

| ID | Kockázat | Hatás | Ellenintézkedés |
|---|---|---|---|
| **R1** | A Supabase **Free** projekt **1 hét inaktivitás után szünetel** | szünetelő projekt **nem küld emlékeztetőt** — egy emlékeztető-app számára kritikus | személyes használatra elfogadható; **éles indulás előtt Pro** (vagy rendszeres aktivitás); a heti ellenőrzőlistában szerepel (§23.6) |
| **R2** | **iOS**: push csak a Kezdőképernyőre tett appnál | iPhone-os felhasználók értesítés nélkül maradhatnak | iOS-útmutató + onboarding + **ICS-feed** + e-mail tartalék; P2: Capacitor |
| **R3** | **Brave** alapból tiltja a push-szolgáltatást; egyes Android-gyártók agresszív akkumulátor-kímélése késleltetheti a push-t | „nem jön értesítés" jelentések | diagnosztika + célzott hibaüzenet (§12.9–12.10); a gazda saját böngészője Brave → **korán tesztelendő** |
| **R4** | **Vercel Hobby** csomag személyes, nem kereskedelmi használatra való | üzleti indulásnál feltételsértés | üzleti indulás előtt Pro |
| **R5** | Hírforrások **felhasználási feltételei**/RSS-formátum változása; képek hotlinkelése | jogi kockázat; törött feed | csak cím + ≤ 200 kar. + visszalink; forrásonkénti kapcsoló; `last_status` figyelés; a gazda jóváhagyja a listát (Q6) |
| **R6** | A DB jelszó **nyílt chatben** megosztva | kompromittáltnak tekintendő | **rotálás éles indulás előtt**; addig nem kerül sehová (H3) |
| **R7** | Egyetlen projekt = éles; **nincs automatikus mentés** | adatvesztés / rossz migráció | H5, helyi/dev környezet (Q3), kézi `pg_dump`, `export_my_data`, Pro |
| **R8** | **E-mail kézbesíthetőség** (SPF/DKIM/DMARC) és a Supabase küldési limitek (egyéni SMTP-nél alapból 30/óra) | a megerősítő levél spamben/nem érkezik | egyéni SMTP + domain-hitelesítés (A-04); rate limit emelése; „Újraküldés" gomb |
| **R9** | **Katalógus-adat pontatlansága** (árak, tartalom-átfedés) | téves tipp | `verified_at` + forrás, „becslés" jelölés, csak ellenőrzött adat (H7), „Miért látom?" |
| **R10** | A `@negrel/webpush` saját állítása szerint **nem auditált** | kripto-hiba | spike (A-20); szükség esetén `npm:web-push` |
| **R11** | Időzóna/DST hibák az értesítés-ütemezésben | rossz órában érkező értesítés | `AT TIME ZONE` + pgTAP DST-vektorok (§8.4) |
| **R12** | **Scope** nagy (sok funkció) | késés, félkész részek | P0/P1/P2 + **MVP-vágás** (S3 + analitika-alapok) |
| **R13** | Függőség-sodródás (Next 16, Recharts 3, next-intl 4…) | törő változások | verziók rögzítve; főverzió-váltás tilos munkamenet közben |
| **R14** | Jogi megfelelés (GDPR, ÁSZF, adatkezelési tájékoztató) | jogi kockázat | §9.4; a jogi szöveget a gazda/jogász adja (Q7); addig „TERVEZET" |
| **R15** | A ClimarkAI kód **tulajdonjogi helyzete tisztázatlan** (LICENSE/NOTICE/fejlesztői szerződés) | jogvita | **nem másolunk kódot** (H1); csak mintát tanulunk |
| **R16** | Egy **MCP Supabase-connector** más fiókhoz/projekthez lehet kötve | rossz projekten futó SQL | H2: minden művelet előtt `get_project_url` + `db:assert`; eltérésnél STOP |

### 26.2 Nyitott kérdések a gazdának (válasz nélkül is indulhat a munka a jelölt alapértelmezéssel)

| ID | Kérdés | Alapértelmezés, amíg nincs válasz |
|---|---|---|
| **Q1** | Végleges **név, domain, logó, márkaszín**? | „Bank Reminder", teal (`#0B7F70`), ideiglenes harang-ikon |
| **Q2** | Melyik **e-mail szolgáltató** (Resend / Brevo / Postmark / AWS SES / …) és milyen **feladó-domain**? *(A ClimarkAI SES-hozzáférését **csak** a gazda kifejezett döntésével, külön beállítással használjuk — a fájlt nem olvassuk.)* | tesztelés a saját címekre az alap SMTP-vel (csapattag); **éles regisztráció előtt kötelező** |
| **Q3** | **Fejlesztői környezet**: helyi Supabase (Docker) / második ingyenes projekt (`bank_reminder_dev`) / csak az éles? | helyi Docker, ha telepíthető; különben az egyetlen projekt fokozott óvatossággal (H5) |
| **Q4** | **Hosting**: Vercel-fiók/team? Saját domain? | Vercel Hobby `*.vercel.app` |
| **Q5** | A **DB jelszó** rotálása *mikor*? (R6) | éles indulás előtt, a gazda végzi |
| **Q6** | A **hírforrások** listája (§18.1) jóváhagyható? Vagy csak 2–3 forrással indulunk? | induláskor: Pénzcentrum (vásárlás, megtakarítás) + Telex + Portfolio, a többi kikapcsolva |
| **Q7** | **Jogi szövegek** (adatkezelési tájékoztató, ÁSZF) — ki írja? | „TERVEZET" helyőrző |
| **Q8** | Támogatott **pénznemek**: HUF + EUR + USD, vagy több (RON, CZK, PLN, GBP…)? | HUF, EUR, USD, GBP, CHF, RON, CZK, PLN (a Frankfurter/ECB mind támogatja) |
| **Q9** | A **szolgáltatás-katalógus** kezdőlistája (pl. Netflix, HBO Max, Disney+, Prime Video, Spotify, YouTube Premium, Apple/iCloud, Google One, Telekom, Yettel, One, Digi, MVM, E.ON…) és **ki ellenőrzi az árakat**? | csak név+kategória+logó; **ár/tartalom-adat nélkül**, amíg nincs ellenőrzött forrás |
| **Q10** | Cél: **személyes használat** vagy **nyilvános indulás** (felhasználók)? | személyes/zárt béta → az R1/R4 elfogadható |
| **Q11** | Kell-e később **Google-belépés** (OAuth)? | nem (P2) |
| **Q12** | Alapértelmezett értesítés: **1 nappal előtte, 09:00** rendben? | igen |
| **Q13** | Legyen-e az **„automatikusan kifizetett" (csoportos beszedés)** opció v1-ben? | igen (kikapcsolva alapból) |
| **Q14** | Kell-e a **Dashboardra „Számlaegyenleg"** (ref-3 jobb alsó kártya)? *(Az app nem kapcsolódik bankhoz → csak kézi egyenleg lehetne.)* | nem, v1-ben kihagyva |

---

## Függelék A — Környezeti változók

| Változó | Hol | Titok? | Megjegyzés |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | nem | `https://ddvzslgwexvdolovqqlg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel | nem (publikus-by-design) | a gazda útmutatójából (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, Vercel | nem | `http://localhost:3000` / éles domain |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local`, Vercel | nem | `npm run gen:vapid` kimenete |
| `SUPABASE_DB_PASSWORD` | **csak helyben** (CLI) | **igen** | a gazda adja; **soha** fájlba/repóba |
| `SUPABASE_ACCESS_TOKEN` | **csak helyben** (CLI login) | **igen** | |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | **Edge Function secret** (`supabase secrets set`) | **igen** | `VAPID_SUBJECT=mailto:…` |
| `CRON_SECRET` | **Vault** + Edge secret | **igen** | kézzel, egyszer |
| `EMAIL_API_KEY` / SMTP-adatok, `EMAIL_FROM` | Edge secret + Auth SMTP | **igen** | Q2 |
| *(auto)* `SUPABASE_URL`, `SUPABASE_SECRET_KEY`/service-role | Edge Function-ökben automatikusan | **igen** | **a Next.js-nek ezekre nincs szüksége** — a Vercelbe **nem** kerül secret key |

**`.env.example`** (a repóba; értékek nélkül a titkoknál):

```bash
# --- publikus (a kliensbe kerül) ---
NEXT_PUBLIC_SUPABASE_URL=https://ddvzslgwexvdolovqqlg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# --- csak helyben, SOHA nem commitolva ---
# SUPABASE_DB_PASSWORD=
# SUPABASE_ACCESS_TOKEN=
```

---

## Függelék B — Referencia-képek leképezése

A képek a `docs/reference/` mappában vannak. **Kinézet-irány, nem pixel-másolás** (és a 2. kép AI-generált, a szövegei értelmetlenek — a szövegeit ne vedd át).

| Fájl | Mit mutat | Amit átveszünk | Amit másképp csinálunk |
|---|---|---|---|
| `ref-1-dashboard-donut.png` | Mobil dashboard: **„Monthly Spending $2,450"** fánk, **Bills Due** (Electric, Internet), **Subscriptions** (Netflix, Spotify, Gym) kártyák | Főoldal hero-fánk + „Hamarosan esedékes" + „Előfizetések" (§14.5); fehér, kerek kártyák | HUF, a saját validált paletta, „Kifizettem" gyorsgomb, hónap-váltó |
| `ref-2-savings-tracker.png` | „Budget Tracker & Bill Reminder / Savings Tracker": **megtakarítási célok** csúszka-sávokkal, oszlopdiagram, zöld-kék paletta | `/savings` kártyák + folyamatjelző; vizuális hangulat (türkiz/kék) | a kép szövege értelmetlen (AI-generált) → **nem** vesszük át; a cél-logika a §16.4 |
| `ref-3-bills-list-desktop-mobile.png` | Laptop + telefon: **Bills List** (kapcsolókkal: „Electric Bill $120.50 ◉"), **Upcoming Reminders** (Mortgage – Oct 31), **Account Balances** (Checking/Savings) | Emlékeztető-lista kapcsolóval (🔔 be/ki), jobb oldali „Upcoming" kártya, asztali kétoszlopos elrendezés | **Account Balances kimarad** (nincs banki kapcsolat — Q14) |
| `ref-4-spending-budgets-dark.png` | **Sötét mód**: *Spending & Budgets*, kategóriánként folyamatjelző sáv, **piros = túllépés** „!" ikonnal, felül „1 870 $ / 2 535 $" | `/budgets` (§16.1) és a sötét téma hangulata (mély palaszürke, lila sávok) | piros állapot **mindig ikon + szöveg** (nem csak szín), a keret-szegmens „még hátralévő számlák" |

---

## Függelék C — Kategóriák és színcsoportok

Seed: `supabase/seed/categories.sql` (A-08). A **`color_slot`** a csoport színe (§15.3); a diagram **csoportonként** aggregál, a lista **kategóriánként**. A *piros* (8. slot) szándékosan nincs kiosztva.

| Csoport (slot) | `key` | HU | EN | Ikon (lucide) | Típus |
|---|---|---|---|---|---|
| **1 · Előfizetések** | `streaming` | Streaming | Streaming | `tv` | bill |
| | `music` | Zene | Music | `music` | bill |
| | `software` | Szoftver és felhő | Software & cloud | `cloud` | bill |
| | `gaming` | Játék | Gaming | `gamepad-2` | bill |
| **2 · Lakhatás & rezsi** | `rent` | Lakbér | Rent | `home` | bill |
| | `utilities` | Rezsi | Utilities | `zap` | bill |
| | `maintenance` | Közös költség, karbantartás | Maintenance fees | `wrench` | both |
| **3 · Telefon & internet** | `mobile` | Mobiltelefon | Mobile | `smartphone` | bill |
| | `internet` | Internet és TV | Internet & TV | `wifi` | bill |
| **4 · Biztosítás & adó** | `insurance` | Biztosítás | Insurance | `shield-check` | bill |
| | `taxes` | Adó | Taxes | `landmark` | bill |
| **5 · Hitel & díjak** | `loans` | Hitel, törlesztés | Loans | `banknote` | bill |
| | `bank_fees` | Bankköltség | Bank fees | `credit-card` | bill |
| **6 · Mindennapi** | `groceries` | Élelmiszer | Groceries | `shopping-basket` | both |
| | `household` | Háztartás, drogéria | Household | `spray-can` | both |
| | `transport` | Közlekedés | Transport | `bus` | both |
| **7 · Életmód & család** | `eating_out` | Étterem | Eating out | `utensils` | expense |
| | `shopping` | Vásárlás, ruházat | Shopping & clothing | `shopping-bag` | expense |
| | `fun` | Szórakozás | Fun money | `party-popper` | expense |
| | `sports` | Sport, fitness | Sports & fitness | `dumbbell` | both |
| | `personal_care` | Szépségápolás | Personal care | `sparkles` | expense |
| | `health` | Egészség | Health | `heart-pulse` | both |
| | `education` | Oktatás | Education | `graduation-cap` | both |
| | `kids` | Gyerek | Kids | `baby` | both |
| | `gifts` | Ajándék, adomány | Gifts & donations | `gift` | expense |
| | `travel` | Utazás | Travel | `plane` | both |
| **9 · Egyéb** | `other` | Egyéb | Other | `circle-ellipsis` | both |

A csoportnevek (HU/EN): 1 *Előfizetések / Subscriptions* · 2 *Lakhatás és rezsi / Housing & utilities* · 3 *Telefon és internet / Phone & internet* · 4 *Biztosítás és adó / Insurance & taxes* · 5 *Hitel és díjak / Loans & fees* · 6 *Mindennapi / Everyday* · 7 *Életmód és család / Lifestyle & family* · 9 *Egyéb / Other*.

---

## Függelék D — Microcopy kulcsok (kezdőkészlet)

> Nem teljes: az AI-B bővíti a `locales/*.json`-ban; **a hangnem** ez. HU a forrás-igazság; az EN természetes, nem szó szerinti.

| Kulcs | HU | EN |
|---|---|---|
| `common.appName` | Bank Reminder | Bank Reminder |
| `auth.login.title` | Üdv újra! | Welcome back |
| `auth.login.submit` | Belépés | Log in |
| `auth.login.stay` | Maradjak bejelentkezve | Stay signed in |
| `auth.login.forgot` | Elfelejtett jelszó? | Forgot password? |
| `auth.signup.title` | Hozd létre a fiókodat | Create your account |
| `auth.signup.submit` | Regisztráció | Sign up |
| `auth.signup.accept` | Elfogadom az Adatkezelési tájékoztatót és az ÁSZF-et | I accept the Privacy Policy and Terms |
| `auth.checkEmail.title` | Nézd meg a leveled 📬 | Check your inbox 📬 |
| `auth.checkEmail.body` | Ha az e-mail cím még nincs regisztrálva, küldtünk egy megerősítő levelet. A link 1 óráig érvényes. | If this email isn't registered yet, we've sent a confirmation link. It's valid for 1 hour. |
| `auth.checkEmail.resend` | Levél újraküldése | Resend email |
| `auth.error.invalidCredentials` | Hibás e-mail vagy jelszó. | Wrong email or password. |
| `auth.reset.sent` | Ha létezik ilyen fiók, küldtünk egy levelet a visszaállításhoz. | If an account exists, we've emailed you a reset link. |
| `dashboard.hello` | Szia, {name}! | Hi, {name}! |
| `dashboard.monthTotal` | Havi kiadás | Monthly spending |
| `dashboard.upcoming` | Hamarosan esedékes | Due soon |
| `reminders.empty.title` | Még nincs emlékeztetőd | No reminders yet |
| `reminders.empty.body` | Vedd fel az elsőt 20 másodperc alatt — és mi időben szólunk. | Add your first in 20 seconds — we'll nudge you in time. |
| `reminders.new` | Új emlékeztető | New reminder |
| `reminders.pay` | Kifizettem | Paid |
| `reminders.snooze` | Később | Later |
| `reminders.overdue` | Lejárt | Overdue |
| `reminders.dueTomorrow` | holnap | tomorrow |
| `reminders.form.notify` | Értesítés | Notify me |
| `reminders.form.when` | Mikor szóljunk? | When should we remind you? |
| `reminders.form.sameDay` | aznap | same day |
| `reminders.form.daysBefore` | {n, plural, one {# nappal előtte} other {# nappal előtte}} | {n, plural, one {# day before} other {# days before}} |
| `budgets.left` | {amount} maradt | {amount} left |
| `budgets.over` | {amount} túllépés | {amount} over |
| `install.cta` | Alkalmazás letöltése | Download the app |
| `install.ios.step1` | Koppints a Megosztás ikonra | Tap the Share icon |
| `install.ios.step2` | Válaszd: Kezdőképernyőhöz adás | Choose "Add to Home Screen" |
| `install.installed` | Telepítve ✔ | Installed ✔ |
| `push.enable` | Értesítések bekapcsolása ezen az eszközön | Turn on notifications on this device |
| `push.test` | Teszt-értesítés küldése | Send a test notification |
| `push.brave` | A Brave alapból tiltja a push-szolgáltatást — kapcsold be a „Use Google services for push messaging" beállítást, majd indítsd újra. | Brave blocks the push service by default — turn on "Use Google services for push messaging", then restart. |
| `news.freshness.fresh` | Friss | Fresh |
| `news.freshness.stale` | Lehet, hogy már nem aktuális | May no longer be current |
| `news.deal.disclaimer` | Hírforrás alapján — az akció feltételeit és érvényességét ellenőrizd az üzletnél. | Based on a news source — check the offer's terms and validity in store. |
| `news.source` | Forrás: {name} | Source: {name} |
| `tips.disclaimer` | A tippek becslések, nem pénzügyi tanácsadás. | Tips are estimates, not financial advice. |
| `disclaimer.notBank` | A Bank Reminder nem bank és nem pénzügyi tanácsadó. Nem fér hozzá a bankszámládhoz. | Bank Reminder isn't a bank or financial advisor. It can't access your bank account. |
| `common.undo` | Visszavonás | Undo |
| `common.error.generic` | Hopp, valami elromlott. Próbáld újra. | Oops, something went wrong. Please try again. |

---

## Függelék E — Indító promptok a két AI-nak

> A gazda ezeket másolja be az **első üzenetként** egy-egy új munkamenetbe (külön ablak/worktree). Mindkettőt a `D:\Projectss\Bank_Reminder` mappában kell indítani.

### AI-A (Platform) — indító prompt

```
Te vagy az AI-A (Platform) a Bank Reminder projekten (D:\Projectss\Bank_Reminder).
1) Olvasd el TELJESEN az ARCHITECTURE.md-t, különösen: §2 (KEMÉNY SZABÁLYOK), §6, §7, §8, §9, §12, §21, §24.2, §25.
2) Szabályok: a D:\CliMark\CliMarkAI-Client-Marketing-AI-main mappába NEM írhatsz (csak olvashatsz, titkos fájlokhoz nem nyúlsz); a ClimarkAI Supabase-ét SOHA nem használod;
   egyetlen engedélyezett Supabase projekt: ddvzslgwexvdolovqqlg — minden Supabase-művelet előtt futtasd a db:assert-et (vagy MCP-nél get_project_url ellenőrzés);
   titok (DB jelszó, sb_secret_…, VAPID privát) sehova nem kerül fájlba/chatbe; destruktív DB-művelet csak a gazda jóváhagyásával.
3) Csak a saját könyvtáraidba írsz: supabase/**, scripts/(assert-project|gen-vapid|db-types).mjs, types/database.types.ts (generált), types/rpc.ts.
4) Kezdd a §24.2 feladataival sorrendben: A-01, A-02, A-03, majd M1 (A-06 a legfontosabb: AI-B erre vár). Minden feladat végén: kapuk (§22.2), docs/STATUS.md frissítése, commit "[A] A-xx: …".
5) Szerződést (§8/§21) egyoldalúan nem változtatsz — docs/CONTRACT_CHANGES.md.
Először csak foglald össze 10 sorban, mit értettél, és melyik feladattal kezdesz; utána dolgozz.
```

### AI-B (Experience) — indító prompt

```
Te vagy az AI-B (Experience) a Bank Reminder projekten (D:\Projectss\Bank_Reminder).
1) Olvasd el TELJESEN az ARCHITECTURE.md-t, különösen: §2 (KEMÉNY SZABÁLYOK), §5, §7, §10, §12–§16, §19–§21, §24.3, §25. Nézd meg a docs/reference/ képeit.
2) Szabályok: a D:\CliMark\CliMarkAI-Client-Marketing-AI-main mappába NEM írhatsz (csak mintaként olvashatod; kódot nem másolsz; titkos fájlokhoz nem nyúlsz);
   a ClimarkAI Supabase-ét SOHA nem használod; titkot nem írsz ki; a Next.js alkalmazásban nincs secret key.
3) Csak a saját könyvtáraidba írsz: app/**, components/**, lib/**, locales/**, public/**, tests/**, utils/supabase/**, proxy.ts, scripts/gen-icons.mjs és a konfigok (package.json főként te).
   A supabase/** és a types/database.types.ts az AI-A-é — onnan csak olvasol.
4) Kezdd a §24.3 feladataival sorrendben: B-01, B-02, B-03; amíg az AI-A séma nincs kész, fixture-ökkel és a /dev/ui játszótéren dolgozol (§21.7). Minden UI-szöveg HU és EN. Minden feladat végén: kapuk (§22.2: typecheck, lint, i18n:check, test, BUILD), docs/STATUS.md, commit "[B] B-xx: …".
5) Szerződést (§8/§21) egyoldalúan nem változtatsz — docs/CONTRACT_CHANGES.md.
Először csak foglald össze 10 sorban, mit értettél, és melyik feladattal kezdesz; utána dolgozz.
```

---

*A dokumentum vége. Karbantartás: a változásokat a `docs/CONTRACT_CHANGES.md` és `docs/DECISIONS.md` rögzíti; ezt a fájlt a javaslattevő pontosítja az elfogadás után (§25.3).*

