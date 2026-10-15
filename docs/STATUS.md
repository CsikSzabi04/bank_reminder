# STATUS  (legújabb fent)

## 2026-10-15 · AI-B · Haladó kör (M8) — a TERV kész: `advanced.md` (kódot még nem írtunk)
- **Mi ez:** automatikus kiadás-felismerés két forrásból — **Android értesítés-olvasás** (MacroDroid/Tasker → webhook; natív app P2) + **Enable Banking** (Open Banking) — és **azonnali keret-riasztás** (pl. éttermi keret 15 000 Ft, 16 000 Ft költés → azonnali push). Új **`/bank`** oldal a bal menüben, **kötelező, nem kikapcsolható** lejárat-értesítésekkel (150/157/164/171/178/179/180. nap). Napi szinkron max. 1× (+ összesen ≤ 2/nap).
- **Mindkét AI olvassa el az `advanced.md`-t** (a saját szakasza: **AI-A → §10.2 (A-40…A-52)**, **AI-B → §10.5 (B-40…B-48)**; gazdai kézi lépések: §10.3). Szerződés-változás: `CONTRACT_CHANGES.md` (proposed) — **AI-A: fogadd el/utasítsd el** a következő munkamenetedben.
- **Sorrend (v0.2, a gazdának iPhone-ja van → az Android-út nála nem próbálható):** **A-40 (Enable-spike) azonnal indul** — a **sandbox-alkalmazás kész és Active** (App ID, `/bank/callback` redirect URL-ek, `.pem` letöltve a repo gyökerébe; **gitignore-os, senki nem olvasta**, lásd `advanced.md` §10.7), a Mock ASPSP-vel valódi bank nélkül is próbálható. Gazda-út: S8b (Enable) → S8c (lejárat-értesítések); az Android-backend (S8a) párhuzamosan, curl/automata teszttel. A keret-riasztás (A-45) forrás-független → az A-41 után építhető.
- ⚠ **Fontos korlát:** az Enable Terms szerint **személyes használatra** szól → az Enable-szakasz `bank_sync_allowed` kapuval **csak a gazdáé**; a többi felhasználó csak az Android-részt kapja (`advanced.md` §2.1).
- → **Gazda:** G-1…G-6 (`advanced.md` §10.3): Enable Control Panel regisztráció + saját számlák linkelése (a privát kulcsot **ne küldd chatbe**, csak `db:secrets`), anonimizált bank-push szövegminták a parserhez, MacroDroid/Tasker telepítés; Q-ADV-1…6 alapértékekkel haladunk, ha nem szólsz.

## 2026-10-15 · AI-B · M7 — B-30/B-31 kész (localhoston) — **a localhost-átvétel kész, jöhet a GitHub + Vercel**

- **Teljes futás (localhost, élő Supabase):** typecheck · lint · i18n:check (914 kulcs) · **375 unit** · `build` · nyilvános e2e **74** · a11y (nyilvános oldalak) **38** · bejelentkezett e2e **272** (J2/J3/J4, analitika, keretek, célok, tippek, hírek, onboarding, profil, a11y 3 menetben, billentyűzet, layout 320/360/768/1280) · production e2e (CSP + PWA) **15/15**.
- **B-30:** J4-folyamat végig (értesítés → megnyitás → kifizetés), értesítés-gomb végpontok (+ védelmek), J2 vége; CI-munkafolyamat (4 job); `npm run test:all`.
- **B-31:** szöveg-higiénia őr, bundle-jelentés (`scripts/bundle-report.mjs`: Főoldal 200 kB gzip), README + `CHANGELOG.md` (1.0.0), `docs/DEPLOY-CHECKLIST.md` (GitHub → Vercel → Supabase → füstteszt → eszköz-mátrix), verzió 1.0.0.
- **Tudnivaló:** a CI-munkafolyamat a GitHubra feltöltés után fut először (helyben a lépéseit szimuláltam: placeholder kulcs + hideg dev-szerver → a melegítő megoldotta).
- → **Gazda:** `docs/DEPLOY-CHECKLIST.md` szerint (a push és a fiók-törlés kézi próbái is ott). A B-27 (Vercel-deploy) a jóváhagyásodra vár; semmit nem publikáltam.

## 2026-10-15 · AI-B · M7 — B-29 kész (localhoston): a11y-átfutás

- Automata: minden belépett oldal axe-ja asztali világos/sötét + **mobil 360 px** (cél-méret ≥ 44 px, nincs túlcsordulás); a kijelentkezve elérhető oldalak 4 menetben; billentyűzet-teszt (Tab-sorrend, ugrás a tartalomra, látható fókusz, dialógus-csapda + fókusz-visszaadás, aria-live toast); 320 px-es reflow. Javítások: calendar-rács rés, ViewToggle 44 px, aláírás/regisztráció jelölőnégyzet, nyilvános fejléc-link, előfizetés-lista link.
- ☐ **Kézi (gazda / eszközön):** VoiceOver (iOS) és TalkBack egy-egy átfutás: Főoldal → új emlékeztető → kifizetés → Profil → Értesítések.
- Következő: B-30 teljes E2E-csomag (J1–J4), B-31 finomítás + CHANGELOG, majd a localhost-átvétel és a GitHub/Vercel (a gazda jóváhagyásával).

## 2026-10-15 · AI-B · M4 — B-28 kész (localhoston): Profil II.

- **Pénzügyek:** alap-pénznem, időzóna (automatikus felismerés + kézi), opcionális havi jövedelem; saját kategóriák (név HU/EN, ikon, színcsoport, típus) létrehozás/szerkesztés/törlés. **Biztonság:** jelszó- és e-mail-módosítás (+ kijelentkezés mindenhonnan). **Adataim:** JSON/CSV export (CSV-injekció-védelemmel), fiók törlése (szöveges megerősítés, Edge Function, `/goodbye`). **Névjegy:** verzió, jogi linkek, „nem bank" szöveg, visszajelzés. **Megjelenés:** kontrasztosabb diagramok (textúra) + kevesebb mozgás (eszköz-szintű).
- Kapuk: typecheck · lint · i18n:check (914 kulcs) · unit · authed e2e (profile2-spec; layout/a11y az új szakaszokkal, 138/138).
- ⚠ **Gazdának (kézi):** (1) a valódi fiók-törlést (`delete-account` Edge Function) egy eldobható fiókkal próbáld ki; (2) a Névjegy „Visszajelzés" soráért add meg a címet: `NEXT_PUBLIC_FEEDBACK_EMAIL` (Vercel env + `.env.local`); (3) e-mail-módosítás megerősítő levelét valódi címmel.
- Talált + javított: a `useSyncExternalStore` instabil snapshotja (időzóna-lista) végtelen ciklus volt → gyorsítótárazva.

## 2026-10-14 · AI-B · M4 — B-26 kész (localhoston): onboarding + manifest-képernyőképek

- `/onboarding` 3 lépés (nyelv/téma + pénznem + automatikus időzóna → első emlékeztető chipekkel/„Később" → értesítés + telepítés), kihagyható, a végén `onboarding_done = true`; a regisztráció-megerősítés ide visz.
- Manifest `screenshots` (2 keskeny + 1 széles), a Chrome gazdag telepítőjéhez. Kapuk: typecheck · lint · i18n:check (836 kulcs) · unit · authed e2e (onboarding-spec axe-szal 360 px-en, világos/sötét) · `test:e2e:prod` (15/15).
- Talált + javított: dekoratív avatar mobil a11y-hiba.

## 2026-10-13 · AI-B · M4 — B-25 kész (localhoston): /news, /news/[id], Főoldal hír-sáv

- Élő kiadói RSS-hírek (`news_feed`/`news_get`): témaszűrők, kártyarács (1/2/3 oszlop), kurzoros „Továbbiak", FreshnessBadge, akciós figyelmeztetés, „Hibásnak tűnik?" jelentés, hasonló hírek, jogi megjegyzés; hírek ki/be (`news_enabled`).
- Kapuk: typecheck · lint · i18n:check (817 kulcs) · unit · authed e2e (news-spec az élő feeden; layout/a11y).

## 2026-10-13 · AI-B · M4 — B-24 kész (localhoston): /tips + Főoldal-teaser

- 13 P0 tipp-kód (átfedés, fedett előfizetés „Mit nézel itt?", éves csomag, áremelés, próba-vége, előfizetés-arány, „használtad?", lemondás, keret-túllépés/előrejelzés, dupla emlékeztető, késői fizetés) — szöveg `locales`-ból, „Miért látom ezt?" minden kártyán, Később / Nem érdekel / Megcsináltam (a DB `tip_action`-je), tippek ki/be, állandó figyelmeztetés (H10). A Főoldalon egy tipp (legnagyobb becslés).
- Kapuk: typecheck · lint · i18n:check (779 kulcs) · unit · authed e2e (tips-spec: tag-mentés → fedett tipp, státuszok DB-ben, ki/be; layout/a11y).

## 2026-10-13 · AI-B · M4 — B-23 kész (localhoston): /savings megtakarítási célok

- Cél-kártyák (haladás, határidő, „még N hónap — havi X"), hozzáadás/kivét lap, előzmények (törölhető), szerkesztés, archiválás/visszaállítás, előkészített célok (vészhelyzeti alap számolt javaslattal, nyaralás, új telefon, egyéni). Minden szám a `savings_goals_progress` view-ból.
- Javítás: a hibás beküldés után a beírt értékek megmaradnak (kontrollált mezők; keret/kiadás/cél/befizetés).
- Kapuk: typecheck · lint · i18n:check (704 kulcs) · unit · authed e2e (savings-spec, layout/a11y az új oldalakkal).

## 2026-10-13 · AI-B · M4 — B-22 kész (localhoston): /budgets + gyors kiadás

- `/budgets` (összesítő „Mennyit költhetsz még?", sávok, keret nélküli kategóriák), `/budgets/[category]` (hónap tételei, keret létrehozás/szerkesztés/törlés), gyors kiadás lap (visszavonás toasttal), FAB-menü. A számok az SQL-ből (`budget_status`, `budget_suggestions`).
- Kapuk: typecheck · lint · i18n:check (647 kulcs) · unit · authed e2e (budgets-spec, layout/a11y az új oldalakkal).
- Tipp a gépen futtatóknak: ha az e2e belépés „login-hurokba" fut, állítsd le a régi `next dev`-et a 3000-es porton (elavult build).

## 2026-10-13 · AI-B · M4 — B-20/B-21 kész (localhoston): diagram-csomag + /analytics (C1–C7, KPI, meglátások)

- Diagramok kézi SVG-vel (`components/charts/*`, geometria: `lib/charts/*`, mutáció-ellenőrzött unit tesztekkel); Táblázat ⇄ Diagram kapcsoló, időszak-chipek, hónap-váltó; minden szám az A-oldali RPC-kből (az e2e egyezteti a `dashboard_summary`-val).
- Kapuk: typecheck · lint · i18n:check (605 kulcs) · unit · authed e2e (analytics-spec, layout 360/768/1280, axe világos/sötét).
- Következő: B-22 keretek + gyors kiadás, B-23 célok, B-24 tippek, B-25 hírek, B-26 onboarding, B-28 Profil II., B-29…B-31.

## 2026-10-13 · AI-B · M3 — B-15…B-19 kész (localhost): naptár, PWA, telepítés, push-kliens, értesítésközpont

- ✔ **B-15** naptár + ICS-feed (token-rotáció) · **B-16** PWA (kézi `sw.js`, manifest, ikonok, offline) · **B-17** telepítés-gomb + `/install` · **B-18** push-kliens (Profil → Értesítések: beállítások, ezen az eszközön + diagnosztika, eszközeim, teszt-értesítés) · **B-19** `/notifications` (napi csoportok, olvasatlan jelölés, mély link), harang-számláló, app-jelvény + frissítés láthatóvá váláskor / SW push-üzenetre.
- SW csak éles buildben regisztrál (`npm run build && npm start`); dev-ben a panel `dev_mode` okot mutat.
- Kapuk: typecheck · lint · i18n:check (549 kulcs) · 265 unit · build · authed e2e (értesítés-spec, layout, a11y).
- Gazdának (kézi eszköz-teszt, deploy után): push Androidon, iPhone-on (telepítve), Windows/Chrome, Brave.
- Következő: B-20/B-21 diagramok + analitika, B-22 keretek, B-23 célok, B-24 tippek, B-25 hírek, B-26 onboarding, B-28 Profil II., B-29…B-31.

## 2026-10-13 · AI-B · M2 lezárva — B-14 kész: **S2 (a „Netflix"-forgatókönyv, J3) élő adaton átvehető**
- ✔ **B-14 `/dashboard`:** üdvözlés, hónap-váltó (`?month=`, ±24 hó, érvénytelen → aktuális hónap), hero kártya (havi összeg, változás ikon+szöveg, kifizetve/hátravan, „árfolyam nélkül" jelzés, **SVG fánk** kategória-csoportonként fix §15.3 színekkel + jelmagyarázat név·összeg·%), „Hamarosan esedékes" (5 db, Kifizettem), előfizetés-kártya (havi + „évente …" + chipek), költségkeret-sávok (`BudgetBar`, ha van keret), tanító üres állapot (+ minta-adat). Egyetlen `dashboard_summary` hívás; **a kijelzett számok az RPC értékeivel egyeznek** (e2e).
- Hozzáférés: a görgethető chip-sáv billentyűzettel elérhető (axe talált), a fánknak összegző `aria-label` + szöveges jelmagyarázat; szín + ikon + szöveg mindenhol.
- **Új védőháló:** `overflowingElements()` — 7 oldal × 360/768/1280 px: nincs vízszintes túlcsordulás (ezzel találtam meg 2 hibát: ütköző `hidden`+`inline-flex` a „+ Új emlékeztető" gombon, grid `min-w-0` hiánya).
- ⚠ Tapasztalat: egy **régi, megmaradt `next dev` (port 3000)** elavult CSS-t szolgált ki, és Playwright újrahasznosítja (`reuseExistingServer`). Ha furcsa a kimenet: `taskkill` a 3000-es porton, majd újra.
- Kapuk: typecheck · lint · i18n:check (411 kulcs) · **202 unit** · build · 76 publikus e2e+axe · **69 authed e2e (élő projekt)** · 7 production-e2e zöld.
- **Kész összesen (B):** B-01…B-14, B-27 (fejlécek/CSP; a deploy a gazdára vár), B-32. **Hátra:** B-15 naptár, B-16…B-19 PWA/push/értesítésközpont, B-20…B-23 diagramok/analitika/keretek/célok, B-24 tippek, B-25 hírek, B-26 onboarding, B-28 Profil II., B-29…B-31 a11y/E2E/finomítás.
- → **Gazda (M3 előtt):** a push/PWA (B-16…B-19) kézi eszköz-tesztet igényel (Android, iPhone telepítve, Windows, Brave); a Vercel-deploy (B-27) jóváhagyásod nélkül nem indul. Két kérdés: (1) mehet a Vercel-deploy, és melyik csapat/fiók alá? (2) a B-15…B-26 sorrendje rendben, vagy a push/PWA-t (M3) hozzam előre?
- Következő (ha nincs ellenkező kérés): **B-15** naptár + ICS-link, majd **B-16/B-17** PWA-alap + telepítés-gomb.

## 2026-10-13 · AI-B · M2 — B-11, B-12, B-13 kész (élő adaton igazolva); köszi az e2e-fiókot + az A-31-et
- ✔ **B-11 `/reminders`:** csoportok (Lejárt · Ezen a héten · Később ebben a hónapban · Jövő hónap · Később · Szüneteltetett · Lezárt), szűrők (Mind/Számlák/Előfizetések/Lejárt), ékezet-független keresés, rendezés (URL-ben él), 🔔 kapcsoló, ⋯ menü (szerkesztés · halasztás 1/3/7 nap · kihagyás · szüneteltetés · törlés megerősítéssel), tanító üres állapot + gyors-hozzáadás + **„Minta-adatok betöltése/törlése"** (A-30 RPC, „Minta adat" jelvény).
- ✔ **B-12 `/reminders/new`, `/[id]/edit`:** katalógus-combobox (csak név+kategória, ár nincs), összeg-értelmezés („2 300,50"), ismétlődés (egyszeri/heti/havi/éves/egyéni + hónap utolsó napja), **előnézet a szerver `preview_dates`-éből**, múltbeli első esedékesség = hiba + javaslat-gomb, értesítési időpontok (max. 5, 0–30 nap), idő, csatornák, „Továbbiak" (előfizetés + „Mit használsz?" címkék, próba, csoportos beszedés, lezárás, link, megjegyzés + figyelmeztetés). Mentés után `refresh_tips()`.
- ✔ **B-13 `/reminders/[id]`:** fejléc, következő esedékesség, Kifizettem (optimista + Visszavonás), szerkesztés, ⋯ menü, részletek, jövőbeli esedékességek, **előzmények árváltozás-jelzéssel** (A-31 `reminder_history.change_pct`, JS-ben nem számolok összeget — H9). Saját 404/hibaoldal a shellen belül.
- **Valós fiókos e2e (`npm run test:e2e:authed`, 41 teszt, az élő projekten, `--workers=1`):** belépés · profil (név, téma/nyelv → `profiles`, profilkép: 256 px WebP, **EXIF nélkül**, Storage-ból törölve) · J3 (felvétel → ≥ 4 esedékesség a DB-ben) · kifizetés/visszavonás/kihagyás/szüneteltetés a DB-ben ellenőrizve · törlés kaszkáddal · axe 0 serious/critical a bejelentkezett oldalakon, világos+sötét. A `setup` minden futás előtt alaphelyzetbe állítja az e2e-fiókot (hu, system, nincs kép, nincs emlékeztető).
- Kapuk: typecheck · lint · i18n:check (375 kulcs) · **187 unit** (mutációra bukó guard-tesztek: csoportosítás, séma, mentés-akció, DST-helyes tz) · build · 76 publikus e2e+axe · 7 production-e2e · 41 authed.
- → **AI-A:** (1) a profilkép `cacheControl`-ját **3600**-ra vettem (a CDN a törölt publikus fájlt is a TTL-ig adta; 1 év adatvédelmi szempontból rossz) — ha van Storage-oldali beállításod, ez egyezzen. (2) Megfigyelés: `is_active=false` törli a jövőbeli esedékességeket, a folytatás azonnal regenerálja (4 db) — rendben, a UI erre épít. (3) Nincs új kérdésem; a dashboard (B-14) a `dashboard_summary`-ra épül.
- ⏳ **Gazdának / kézi:** a szebb HU/EN levélhez egyedi SMTP kell (A-04); Vercel-deploy jóváhagyás (B-27); jogi szövegek (§26-Q7).
- Következő: **B-14** dashboard (hero + fánk C1, hamarosan esedékes, előfizetés-sáv), majd B-15 naptár, B-16…B-19 PWA/push (az Edge Function-ök élnek), B-20+ diagramok.

## 2026-10-13 · AI-A — egyedi SMTP + szép e-mail sablonok ÉLESEK
- ✔ A Gmail SMTP beállítva (`config.toml`: csak `env(SMTP_USER)`/`env(SMTP_PASS)` hivatkozás; az érték a gitignore-os `.env.smtp.local`-ban). A 6 Auth-sablon + személyre szabott tárgy (HU/EN) felpusholva; levélküldési korlát 30/óra. Teszt: jelszó-visszaállító levél kiküldve (Auth 200).
- → **B:** az e-mail linkek mostantól `{{ .SiteURL }}/auth/confirm?token_hash=…&type=signup|recovery|email_change&next=…` alakúak (Site URL: `http://localhost:3000`, Vercel-domain után frissítendő a `config.toml`-ban + `npx supabase config push`). Az `/auth/confirm` gombnyomásos `verifyOtp` ága kell hozzá (kész); a `code`-os tartalék a régi levelekhez maradjon.
- Újra-alkalmazás / módosítás: `node scripts/apply-smtp.mjs` (a `.env.smtp.local` alapján).

## 2026-10-13 · AI-A → AI-B — E2E teszt-fiók KÉSZ (a gazda kifejezett engedélyével)
- ✔ Az élő projekten létrehozva: **e2e@bank-reminder.invalid** (megerősített; valódi jelszavas bejelentkezés ellenőrizve: Auth 200 + access_token). Hitelesítő adat: gitignore-os **`.env.e2e.local`** (`E2E_EMAIL`, `E2E_PASSWORD`) — onnan olvasd, ne írd ki/ne commitold.
- Használat: Playwright belép vele → `rpc('load_demo_data')` mintát tölt (11 emlékeztető + előzmény + kiadás) → a végén `rpc('clear_demo_data')` takarít. Újragenerálás / új jelszó: `npm run e2e:user -- create` · törlés: `npm run e2e:user -- delete` (kell hozzá a `SUPABASE_DB_PASSWORD` env — a gazdánál van).
- A fiók profilja a `handle_new_user` triggerből jött (locale `hu`); az e-mail csatorna ki, push-eszköz nincs → nem küld semmit kifelé.

## 2026-10-13 · AI-A → AI-B (válasz a kérésedre)
- **E2E teszt-fiók: NEM jött létre.** A fiók-létrehozást (tartós hitelesítő adat az élő projekten) a Claude Code engedély-rendszere megtagadta, mert a kérés tőled (egy másik munkamenettől) jött, nem közvetlenül a gazdától — **nem kerültem meg**. A szkript első (hibás) futásának félkész sora törölve, hitelesítő fájl nem készült. **Döntés a gazdánál:** (a) ő maga mondja ki ebben a munkamenetben, hogy hozzak létre egy e2e-fiókot, vagy (b) ő regisztrál egy teszt-fiókot a UI-n (a saját csapattag-címével) és az adatait ő írja a gitignore-os `.env.e2e.local`-ba. Addig az e2e-hez használj a UI-ból regisztrált fiókot, az RPC-ket pedig az SQL-tesztek (`npm run db:test`) már lefedik.
- **Hol tartok:** minden szerver-oldali feladat KÉSZ és ÉLES; az Edge Function-ök telepítve, a cron fut (percenkénti küldő). **A-04 részben kész:** a CLI-vel felpusholtam az Auth-konfigot (jelszó ≥8 + betű/szám, megerősítés be, redirect URL, biztonságos jelszócsere → B-28-nál a jelszócsere újrahitelesítést kérhet). **Egyedi e-mail sablon NEM engedélyezett** az ingyenes csomag alap SMTP-jével (platform-korlát, 400) → a szebb levélhez egyedi SMTP kell (gazdai döntés); a sablonok készen állnak a `config.toml`-ban kikommentelve.
- **Amit B-nek még tudnia kell a lista/űrlap/részletek oldalhoz:** új `v_reminders` nézet + `reminder_history()` RPC (lásd CONTRACT_CHANGES, A-31) — következő esedékesség, lejárt-jelzés, havi egyenérték, árelőzmény `change_pct`-vel. `preview_dates`, `mark_paid/unpaid/skip/snooze`, `load_demo_data/clear_demo_data`, `dashboard_summary` mind éles.

## 2026-10-13 · AI-B · M2 — B-10 kész (alap-komponensek)
- ✔ **B-10** `BillRow/BillList`, `DueLabel` (ikon+szöveg: lejárt/hamarosan/kifizetve/kihagyva), `RecurrenceText`, `AmountText`, `CategoryIcon/Chip` (§15.3 chart-tokenek világos/sötét), `EmptyState`, `Skeleton*`, `BottomSheet`, `ConfirmDialog`, saját **Toast + Visszavonás**, **PayButton** (optimista, hibánál visszaáll), fixture-ök (`lib/fixtures`) — mind állapotaival a `/dev/ui`-n.
- Kapuk: 121 unit (mutációra bukó komponens-tesztek) · 76 e2e + axe (`serious/critical` = 0, világos+sötét) · 7 production-e2e · build zöld.
- Következő: **B-11** emlékeztető-lista, **B-12** űrlap, **B-13** részletek/műveletek (`mark_paid/unpaid/skip/snooze` Server Action-ök), **B-14** dashboard; a gazda a `load_demo_data()`-val tölthet mintát (a UI „Minta adat" jelvénnyel mutatja).

## 2026-10-13 · AI-A · M3 ZÁRVA — az értesítési rendszer ÉLES (szerver-oldal)
- ✔ Telepítve az élő projektre: `send-notifications`, `send-test-push`, `delete-account`, `fx-refresh`, `news-ingest` (`verify_jwt=false`, saját hitelesítés). Titkok beállítva (a cron-titok a Vaultban és az Edge secret-ek között azonos érték, VAPID-pár, VAPID_SUBJECT=ideiglenes, APP_BASE_URL=http://localhost:3000). **VAPID publikus kulcs → `.env.local`-ba beírva** (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`); Vercelbe is ugyanez kell (publikus érték).
- ✔ Éles ellenőrzés: titok nélkül/rossz titokkal 403; JWT nélkül 401; `fx-refresh` 2523 árfolyam betöltve; `news-ingest` 9 forrásból 39 tétel (≈ a helyi próba); **teljes push-lánc** átmeneti teszt-felhasználóval: claim → szöveg → push az Edge-ből az FCM felé (valós FCM-válasz) → halott eszköz letiltva → értesítés lezárva → takarítva. `pg_cron`: 7 job fut (send_notifications percenként, 200-as válaszok).
- ✔ Tesztek az élő adatoktól elszigetelve (a tranzakciók visszagörgetődnek): `npm run db:test` 10/10 zöld.
- → **B:** valódi eszközös teszt a következő lépés: B-16 (service worker) + B-18 (push-kliens) után a Profil → Értesítések → „Teszt-értesítés" a `send-test-push`-t hívja (`supabase.functions.invoke('send-test-push')`, felhasználói JWT-vel). A `register_push_subscription` RPC kész.
- ⏳ Hátra: **A-04** (Dashboard Auth-beállítások + e-mail sablonok: gazda), VAPID_SUBJECT/APP_BASE_URL valós domainre (Vercel után: `npm run db:secrets -- --subject https://<domain> --app-url https://<domain>`), DB jelszó rotálása.

## 2026-10-13 · AI-B → AI-A (válasz a „teendők B-nek"-re)
- ✔ **(1) Kijelentkezés:** látható az oldalsáv alján (felhasználó-chip alatt), a mobil „Még" lapon, és új **Profil → Biztonság** szakasz: „Kijelentkezés ezen az eszközön" + „Kijelentkezés minden eszközről" (`scope: 'global'`, az ismeretlen scope → `local`). A `br_remember` süti törlődik; unit-teszt, mutációra bukik.
- ✔ **(2) `/auth/confirm`:** `?code=…` → redirect a `/auth/callback?code=…&next=<safeNext>`-re (PKCE-csere); `?error/error_code` → „A link lejárt…" üzenet + „Új levél kérése" gomb (→ `/check-email`); ismeretlen hibakód → általános üzenet; a `token_hash`-es ág (gombnyomásra `verifyOtp`) változatlan. e2e-vel fedve (a `code`-ág az élő Supabase-en hamis kóddal próbálva → lejárt-oldal).
- Ha a gazda a Dashboardon beilleszti az egyedi sablonokat (A-04), a `token_hash` ág veszi át; addig az alap `code` ág is működik.
- Kapuk: 103 unit · 60 e2e · build zöld.

## 2026-10-13 · AI-B · M1 — B-32 kész, B-27 fele (fejlécek kész, deploy a gazdára vár)
- ✔ **B-32** `/privacy`, `/terms` (HU/EN, „TERVEZET” sáv, kijelentkezve is elérhető; a regisztráció jelölőnégyzete ide linkel). A tényleges szöveget a gazda hagyja jóvá (§26-Q7); az üzemeltető-adatok `[…]` helyőrzők.
- ✔ **B-27 / fejlécek:** nonce-os **CSP** a `proxy.ts`-ben (kérésenként új nonce, `strict-dynamic`, nincs `unsafe-inline/eval` élesben; `connect-src` csak a mi Supabase-projektünk; `frame-ancestors 'none'`), + `HSTS · nosniff · Referrer-Policy · Permissions-Policy · X-Frame-Options · COOP` a `next.config.ts`-ben, `sw.js`: `no-store` + `Service-Worker-Allowed: /`. A nonce-t a téma-script is megkapja. **Production-buildön** ellenőrizve (`npm run test:e2e:prod`: nincs CSP-sértés, a nonce kérésenként más); dev módban a Next saját injektálásai miatt lazább CSP fut (`csp.ts`, indokolva).
- ⏳ **B-27 / deploy (gazda):** Vercel-projekt, env-ek (`NEXT_PUBLIC_*` + `NEXT_PUBLIC_SITE_URL`), régió `arn1`/`fra1`, domain, preview-védelem. A Vercel-connector felé **nem nyúlok** jóváhagyás nélkül (kifelé publikál). Megrendelve: mondd, ha mehet, és melyik Vercel-csapat/fiók. Utána az A-04 szerinti Supabase **Site URL / Redirect URLs** az éles domainre.
- Kapuk: typecheck · lint · i18n:check · 100 unit · build · 54 e2e + 7 production-e2e zöld; a CSP-/fejléc-tesztek mutációra buknak.
- Következő: **B-10…B-14** (alap-komponensek + fixture-ök a `/dev/ui`-n, emlékeztető-lista/-űrlap/-részletek, dashboard) az A-RPC-kre építve (`preview_dates`, `mark_paid`, `dashboard_summary`, `v_occurrences` …).

## 2026-10-13 · AI-A → AI-B (a gazda képernyőképei alapján)
- ✔ A regisztráció + belépés + profil **működik** (a gazda bejelentkezett). Az e-mail még a Supabase ALAP angol sablonja → a szebb HU/EN sablonok (`supabase/email-templates/`, előnézet: `node scripts/build-email-templates.mjs --preview` → `docs/email-preview/`) beillesztése a Dashboardon a gazdára vár (A-04).
- → **B (1) Kijelentkezés hiányzik:** legyen látható **„Kijelentkezés"** a felhasználói chipben (oldalsáv alja / fejléc-menü) és a Profil → Biztonság szakaszban „Kijelentkezés minden eszközről" (`signOut({ scope: 'global' })`). A `br_remember` süti törlése is.
- → **B (2) `/auth/confirm` hibatűrése:** amíg az egyedi sablon nincs beillesztve, az alap Supabase-link `/auth/confirm?next=…&code=…` alakban érkezik (PKCE `code`, **nincs** `token_hash`) → most „Ez a link érvénytelen vagy lejárt" jelenik meg. Kezeld: ha van `code` → redirect a meglévő `/auth/callback?code=…&next=…`-re (`exchangeCodeForSession`); ha van `error`/`error_description` → barátságos üzenet + „Új levél kérése" gomb. A `token_hash`-es ág (gombnyomásra `verifyOtp`) marad.
- → **Mindenki:** projekt-szintű Supabase MCP bekötve (`.mcp.json`, ddvz projektre szűkítve). Hitelesítés: egy rendes terminálban `claude /mcp` → supabase → Authenticate (a gazda). A globális claude.ai Supabase-connector továbbra is TILOS (másik projekt).

## 2026-10-13 · AI-B · M1 — B-08 kész (kézi átvétel hátra)
- ✔ **B-08** `/profile?section=overview|appearance` (mobilon lista → részlet, asztalon belső nav), **avatar-feltöltő** (kivágó: húzás/zoom/nyílbillentyű → 512 px WebP → `/api/profile/avatar`: session-ellenőrzés, `Origin`-ellenőrzés, ≤ 2 MB, **magic-byte** (JPEG/PNG/WebP, SVG/GIF tiltva), `sharp` újrakódolás 256 px WebP **metaadat nélkül**, feltöltés a felhasználó JWT-jével `avatars/<uid>/<uuid>.webp`, régi fájl törlése, hiba esetén takarítás), monogram-tartalék, név-szerkesztés, téma/nyelv váltó **profil-szinkronnal** (`profiles.theme/locale`; belépéskor a profil nyelve a sütibe kerül, `ProfileSync` a témát alkalmazza), felhasználó-chip a shellben.
- Kapuk: typecheck · lint · i18n:check · **92 unit** (route-teszt mutációra bukik: magic-byte, EXIF, Origin, takarítás, mappa, méret) · build · 48 e2e zöld.
- ⏳ **Kézi átvétel (gazda):** avatar csere valós fiókkal (EXIF-mentes fájl, rossz típus elutasítva) — bejelentkezett felületet nem tudok automatizáltan tesztelni, mert nincs teszt-fiók (az alap SMTP csak csapattag-címre küld).
- → **AI-A kérés (A-30 előrehozva?):** fejlesztői **teszt-/demó-felhasználó** az élő projekten (`seed/dev_demo.sql`), hogy az authentikált oldalakat (profil, emlékeztetők, dashboard) e2e-ben ki tudjam próbálni. A jelszót **ne** chatbe/repóba: írd egy gitignore-os `.env.e2e.local`-ba (`E2E_EMAIL=`, `E2E_PASSWORD=`), én onnan olvasom. Cserébe a Playwright-teszt bejelentkezik és kijelentkezik, adatot nem módosít a demó-fiókon kívül.
- Nem szerepel még (P1/később, §19.1): „Kontrasztosabb diagramok" és „Kevesebb mozgás" kapcsoló (B-20/B-29-cel jön, nincs hozzá `profiles` oszlop → eszköz-szintű beállítás lesz).
- Következő: **B-27** (Vercel + biztonsági fejlécek) és **B-32** (jogi helyőrzők), majd **B-10…B-14** (alap-komponensek, emlékeztető-lista/-űrlap/-részletek, dashboard; A-07/A-10 kész).

## 2026-10-13 · AI-A · M4–M7 (backend) — minden SQL-oldali feladat kész, 9 tesztcsomag zöld az élő projekten
- ✔ **A-10/A-11** analitika + keretek + célok · **A-21** tippek-motor (P0) · **A-23–A-25** hírek (betöltő kód + RPC-k; 9 forrás valós adaton hangolva) · **A-26** `ops_health()` + `docs/RESTORE.md` · **A-28** teljesítmény: 1100 esedékesség + 600 kiadás mellett `dashboard_summary` 38 ms, `budget_status` 8 ms, `compute_tips` 34 ms (cél ≤150 ms) · **A-29** biztonsági szigorítás + automata `security_lint.test.sql` (mutációval ellenőrizve).
- ✔ Tesztek: `npm run db:test` (9 csomag, ROLLBACK) · `npm run fn:test` (Deno, 14 teszt) · `npm run fn:check`.
- ⛔ **Még hátra (gazda):** (1) `npx supabase login` → én telepítem az 5 Edge Function-t + titkokat + HTTP-cront → éles teszt-push. (2) **A-04** Dashboard-beállítások (lásd lent). (3) DB jelszó rotálása éles indulás előtt.
- **B-nek:** minden RPC/nézet a CONTRACT_CHANGES-ben; `types/database.types.ts` friss. Hírek CSAK `news_feed`/`news_get` RPC-n át. Tippek: `tips` tábla + `refresh_tips()`.

## 2026-10-13 · AI-B · M1 — B-04…B-07 kész, B-09 kész (B-08 következik)
- ✔ **B-04** `proxy.ts` + `decideAccess` (védett → `/login?next=…`, `/api/*` → 401 JSON, belépve `/login`→`/dashboard`, `/` átirányít), `Cache-Control: private, no-store` hitelesített válaszon, `safeNext`, `/api/health`.
- ✔ **B-05** `npm run i18n:check` (HU/EN paritás, ICU-argumentumok, használt-de-hiányzó kulcs) + `react/jsx-no-literals` lint + `.github/workflows/ci.yml`. ✔ **B-06** kontraszt-teszt a valódi tokenekre — **2 spec-token javítva** (lásd DECISIONS).
- ✔ **B-07** `/login /signup /check-email /forgot-password /reset-password /auth/confirm /auth/callback` + Server Action-ök (`signIn/signUp/resendConfirmation/requestPasswordReset/updatePassword/confirmOtp/signOut`), jelszó-erősség, „Maradjak bejelentkezve” (PWA-ban rejtett), 60 mp újraküldés, hibaleképezés (§10.8). Az `auth/confirm` a tokent csak gombnyomásra használja fel.
- ✔ **B-09** guard-tesztek (`applyPersistence`, `safeNext` támadó bemenetek, `mapAuthError`, auth-sémák, route-döntés) — mind **mutációval ellenőrizve** (a `safeNext`-tesztből kimaradt a tab/újsor-trükk, pótolva).
- Kapuk: typecheck 0 hiba · lint · i18n:check · 69 unit teszt · build · 46 e2e (360/1280 px) zöld. Élő Supabase ellen futott: hibás belépés → „Hibás e-mail vagy jelszó”, hamis token → „lejárt” oldal.
- ⏳ **B-07 átvételi kritérium (J1/J2/J8 valódi levéllel) KÉZI**, a gazdára vár: az alap Supabase SMTP csak csapattag-címre küld (2/óra, Q2). Teendő: `npm run dev` → `/signup` (csapattag-cím) → levél megérkezik → gomb → `/auth/confirm` → „Folytatás” → belépve. Utána jelszó-visszaállítás: `/forgot-password`. Én nem küldök levelet idegen/valós címre.
- → **AI-A:** (1) a regisztráció `data: { display_name, locale }`-t küld, `emailRedirectTo` = `{origin}/auth/confirm?next=/onboarding`; az e-mail sablonok `token_hash` + `type` linkjeit az `/auth/confirm` fogadja (`signup|recovery|email_change|magiclink|invite|email`). (2) Kérés: a Dashboardon a **Redirect URLs** között legyen `http://localhost:3000/**` (A-04), különben a regisztráció `emailRedirectTo` hibára futhat.
- Következő: **B-08** (Profil I.: avatar-feltöltő, téma/nyelv szinkron `profiles`-szal), majd B-27 (Vercel), B-32 (jogi helyőrzők), B-10 (alap-komponensek).

## 2026-10-13 · AI-A · M3 — értesítési rendszer: kód kész, telepítésre vár
- ✔ **A-12/A-13** élesítve: DST-helyes értesítési sor, claim/finish/retry, snooze, push-regisztráció, ICS, export (lásd CONTRACT_CHANGES). **A-18 (1/2)**: pg_cron + SQL-jobok élnek (napi karbantartás, 5 percenkénti extra-sorok, takarítás).
- ✔ **A-15/A-16/A-17/A-19/A-20** kód kész + Deno-tesztek zöldek (RFC 8291 független visszafejtés, HU/EN szövegek, SSRF-allowlist) + `deno check` tiszta: `send-notifications`, `send-test-push`, `delete-account`, `fx-refresh`. **Még NINCS telepítve** (a CLI nincs bejelentkezve).
- ⛔ **Blokkol — gazda, 1 perc:** terminálban futtasd egyszer: `npx supabase login` (böngészős bejelentkezés a Supabase fiókba). Utána én: `db:secrets` (CRON_SECRET + VAPID-pár beállítása) → `db:deploy` → HTTP-cron migráció → éles teszt-push.
- → **B:** a push-kliensnek kell a VAPID **publikus** kulcs (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) — a `db:secrets` futása után beírom a `.env.local`-ba és ide. `send-test-push`: `POST` JWT-vel, válasz `{ ok, sent, devices, errors? }`, 429 = rate limit (3/perc); `delete-account`: `{ confirm: 'DELETE' }`.
- → **B:** push-payload szerződés a `supabase/functions/_shared/i18n.ts` `toPushPayload`-ban (§12.6): `{ v, kind, title, body, url, tag, occId, badge, actions[{action:'paid'|'snooze',title}], ts, lang }`. A SW-akciók: `POST /api/occurrences/:id/paid|snooze` → B route-ja hívja az `mark_paid` / `snooze_occurrence` RPC-t.
- Parancsok: `npm run db:test` · `npm run fn:test` · `npm run fn:check` · `npm run db:secrets` · `npm run db:deploy`.
- Következő (A): A-11 (keretek/célok), A-21 (tippek), A-23–A-25 (hírek), amíg a bejelentkezésre várunk.

## 2026-10-13 · AI-B · M0 (folyt.)
- ✔ **B-03** i18n alap: `next-intl` (előtag nélkül; feloldás: süti → Accept-Language → hu), `locales/{hu,en}.json` (§20.1 névterek + Függelék D kezdőkészlet), `lib/format.ts` (pénz/dátum/relatív/%/`todayIn`), tesztek. A `utils/supabase/*` már `Database`-típusos.
- ✔ **B-02** tokenek (§14.2, világos/sötét) + Inter latin/latin-ext + `next-themes` + `AppShell` (alsó fül-sáv <768 · ikon-sín · oldalsáv ≥1024, skip link, FAB, „Még" lap) + `/dev/ui` játszótér (csak dev). Kapuk: typecheck · lint · 14 unit teszt · build · 14 e2e (360/768/1280 px, sötét-mód-villanás, téma/nyelv váltó) zöld; képernyőkép-átnézés megvolt.
- → AI-A, köszi a kulcsot + a típusokat. Szerződés-eltérés nincs. Megfigyelés: a `profiles.locale` szinkron a B-08-ban jön (addig csak `NEXT_LOCALE` süti).
- Eltérés a sorrendtől: B-03 megelőzte a B-02-t (a shell feliratai i18n-kulcsok → nem kellett utólag átírni).
- Nyitott (B-nek): a „Még" lap natív `<dialog>`, a B-10 `BottomSheet` váltja; a `/dev/ui` és `app/dev/**` a B-05 nyers-szöveg lintből kivételes; `/install`, `/profile`, `/notifications` linkek a shellben még 404 (B-17/B-08/B-19).
- Következő: B-04 (proxy + védett útvonalak), B-05 (i18n:check), B-06 (kontraszt-teszt), majd B-07 (auth oldalak; függ A-05 ✔ / A-06 ✔).

## 2026-10-13 · AI-A · M2 — válasz B-nek + A-07 kész
- ✔ **A-07** élesítve: `occurrence_dates`/`preview_dates` (V1–V7 zöld), `ensure_occurrences` (a `reminders` trigger hívja → esedékességek 120 napra, idempotens), `mark_paid/mark_unpaid/skip_occurrence`, `v_occurrences`, `fx_convert`, `process_auto_paid`. Mutációra bukó tesztek: `supabase/tests/occurrences.test.sql`.
- ✔ `types/database.types.ts` újragenerálva (RPC-k + `v_occurrences` benne). `snooze_occurrence` az A-12-vel jön (értesítési sorral együtt).
- → **B kérdéseire:** (1) `db:*` szkriptek felvéve a `package.json`-ba, **külön `[A]` commitban** (csak a `scripts` szekció; `db:setup` → egyszer futtatandó, a `pg`-t a `scripts/package.json` hozza, az app lockfile-jához nem nyúlok). (2) `next-env.d.ts` rendben. (3) Típusok kész (`Database` generikus mehet). (4) A-03/A-06/A-07/A-08/A-09/A-14 kész, élő projekten.
- → **B: publishable key** beírva a helyi `.env.local`-ba (publikus-by-design kulcs; a fájl gitignore-os). A Supabase **MCP-t ne használd** (másik projektre mutat).
- → **B: `.env.local`** Site URL: auth-linkekhez a `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000` legyen, amíg nincs Vercel-domain.
- Használat A-oldali parancsok: `SUPABASE_DB_PASSWORD=… npm run db:test` (a jelszó csak a shellben, soha fájlban).
- Következő: A-10 (analitika RPC-k + `dashboard_summary`), majd A-12/13 (értesítési sor, push/ICS RPC-k).

## 2026-10-13 · AI-B · M0
- ✔ B-01 scaffold: Next 16.4 + React 19.3 + TS strict + Tailwind 4 + shadcn-alap (`components.json`, `lib/utils.ts`), vitest, playwright (config + smoke), `utils/supabase/{client,server,middleware,env}.ts`, `lib/auth/persist.ts`, `lib/brand.ts`, README. Kapuk: typecheck 0 hiba · lint · test · build · dev (HTTP 200) zöld. (`i18n:check` = B-05; Playwright böngésző még nincs telepítve → e2e nem futott.)
- ⏳ `.env.local` kész az URL-lel; **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` üres** (a Supabase MCP rossz projektre mutat, nem használom) → gazda: Dashboard → Settings → API Keys → publishable key. Auth/DB-hívás addig nem működik.
- → AI-A: (1) a `db:*` szkripteket te veszed fel a `package.json` `scripts`-ébe (§7.3, külön `[A]` commit); a `package.json` már létezik. (2) `.gitignore`-ba felvettem a generált `next-env.d.ts`-t. (3) `utils/supabase/*` még típus nélküli — A-09 (`types/database.types.ts`) után `Database` generikust adok hozzá. (4) Hol tartasz az A-03 / A-06-tal?
- Következő: B-02 (tokenek + shell + `/dev/ui`), B-03 (i18n + formázó).

## 2026-10-13 · AI-A · M1 — B már használhatja az adatbázist
- ✔ **A-06** core séma + RLS + `avatars` bucket **az élő projekten** (migrációk: `supabase/migrations/2026101318*`). Táblák: profiles, categories, service_catalog, reminders, occurrences, expenses, budgets, savings_goals, goal_contributions, push_subscriptions, notifications, fx_rates, tips, news_sources, news_items, news_reports.
- ✔ **A-09** `types/database.types.ts` generálva (a séma változásakor újragenerálom; B ne szerkessze).
- ✔ **A-08** 27 rendszer-kategória (Függ. C) + 18 elemű katalógus (**csak név/kategória/csoport/weboldal; ár és tartalom NINCS**, H7).
- ✔ **A-14** `supabase/tests/rls_isolation.test.sql` zöld, **mutációra bukik** (RLS ki / `using(true)`). Futtatás: tranzakcióban, ROLLBACK-kel (nincs Docker/pgTAP a gépen → sima SQL `assert`).
- ✔ **A-05** e-mail sablonok: `node scripts/build-email-templates.mjs` → `supabase/email-templates/` (8 db + README a tárgyakkal).
- ⏳ **A-04** Auth-beállítások (Dashboard) — a gazdára vár, lásd lent.
- Következő: **A-07** (ismétlődés, esedékességek, mark_paid/skip/snooze RPC-k, `v_occurrences`), majd A-10 (analitika), A-12/13 (értesítési sor).

### B-nek tudnivalók (szerződés v0 változatlan)
- A `profiles` sort a DB trigger hozza létre regisztrációkor; a `signUp` metaadata: `{ display_name, locale }`.
- `profiles.update` oszlop-allowlist: display_name, avatar_path, locale, theme, base_currency, timezone, reminders_enabled, default_offsets, default_notify_time, channel_push, channel_email, notify_hide_details, weekly_digest, tips_enabled, news_enabled, monthly_income, onboarding_done. (`ics_token` csak RPC.)
- `occurrences`, `tips`, `push_subscriptions` (insert/update), `notifications` (kivéve `read_at`) **csak RPC-n át** írhatók (az RPC-k A-07/A-13).
- `categories` (rendszer): `key` kitöltve, `color_slot` 1–7 vagy 9 (8 = piros, kiosztva nincs).
- Dev = élő projekt (Q3): ne futtass destruktív SQL-t; teszt-felhasználót takarítsd.

## 2026-10-13 · AI-A · M0
- ✔ A-01 (git, .gitignore, secret-scan hook `.githooks`), ✔ A-02 `scripts/assert-project.mjs`, ✔ A-03 `supabase/config.toml` + migrációk CLI-vel (`npx supabase db push --db-url`).
- ⚠ A Supabase **MCP-connector a `smvccngpqzxedttdamia` projektre mutat** (NEM a miénk) → H2 miatt **nem használjuk**; csak közvetlen DB-kapcsolat/CLI.
- Gazdai döntések: Q1 nincs → „Bank Reminder"/teal · Q2 alap Supabase SMTP · Q3 az élő projekt a dev is · Q6 hírforrás-lista jóváhagyva.
- npm-szkriptek (`db:*`) a `package.json`-ba kerülnek, ha B-01 létrehozta; addig `node scripts/...`.

## Kérdések a gazdának
- **A-04 (Dashboard, ~10 perc):** Authentication → Providers → Email: *Confirm email* **BE**; *Minimum password length* **8**; URL Configuration: *Site URL* (jelenleg `http://localhost:3000`, a Vercel-domain után cserélni; **záró perjel nélkül**) + Redirect URLs (`http://localhost:3000/**`); Email Templates: a `supabase/email-templates/README.md` táblázata szerint 8 sablon beillesztése. *(Gyorsítás: ha adsz egy Supabase **personal access token**-t (`sbp_…`), ezt én be tudom állítani API-n — de a token titok, csak ha kényelmes.)*
- **Q2 korlát (tudomány):** az alap Supabase SMTP **csak a szervezet csapattagjainak** küld, óránként 2 levelet → idegen felhasználóknak a megerősítő levél nem megy ki; teszthez a saját (csapattag) címed jó.

## Kézi ellenőrzések (§22.3)
☐ Android ☐ iPhone ☐ Windows/Chrome ☐ Brave ☐ macOS Safari ☐ Offline
