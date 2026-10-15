# Bank Reminder — advanced.md
### Haladó funkciók: automatikus kiadás-felismerés (Android értesítés-olvasás + Enable Banking) és azonnali keret-riasztás

> **Verzió:** v0.1 · **Dátum:** 2026-10-15 · **Státusz:** terv, a gazda jóváhagyta az irányt (lásd §1); az Enable Banking **sandbox** alkalmazás létrejött (§10.7) — kódot még nem írtunk. **v0.2 (2026-10-15): a gazda telefonja iPhone → az Android-út nála nem próbálható ki, a sorrend átállt az Enable Bankingre (D8, §10.1).**
> **Kinek:** AI-A (Platform) és AI-B (Experience) — és a gazda (kézi lépések: §10.3).
> **Viszony az ARCHITECTURE.md-hez:** ez a fájl **bővíti** azt. Az ARCHITECTURE.md §1.3 *nem-célja* („bankkártya/bankszámla összekötés, automatikus tranzakció-import") a gazda 2026-10-15-i döntésével **érvényét veszti** erre a körre. A szabályok (§2 H1–H11), a fájl-tulajdon (§7) és a protokoll (§25) **változatlanul érvényesek**; szerződés-változás → `docs/CONTRACT_CHANGES.md` (az első bejegyzés megvan: „proposed").

---

## 0. Egy mondatban

Az app **magától megtudja, mit költöttél**, és **azonnal szól, ha egy kategória havi kerete elfogyott** — két forrásból, amelyek kiegészítik egymást:

| Forrás | Sebesség | Pontosság | Kinek |
|---|---|---|---|
| **Android értesítés-olvasás** (MacroDroid/Tasker → webhook; később natív app) | **azonnali** (másodpercek) | közepes (a push-szövegből olvassuk ki) | mindenkinek, akinek Android telefonja van |
| **Enable Banking** (PSD2 / Open Banking) | **késleltetett** (napi 1 lekérdezés) | **pontos** (a bank saját adata) | a gazdának (lásd §2.1 — a feltételek miatt) |

Az Android-értesítés *ideiglenes* tételt hoz létre, amit a banki adat később **egyeztet és javít** (ugyanaz a tétel nem kerül be kétszer).

**A gazda példája (elfogadási forgatókönyv):** a „Étterem" keret 15 000 Ft/hó. Ma a bank-app push-értesítést küld egy 16 000 Ft-os kártyás vásárlásról → az app felveszi a kiadást („Étterem · 16 000 Ft · ideiglenes") → a keret átbillen → **azonnal** push: *„Étterem: elfogyott a havi keret (16 000 / 15 000 Ft)."* A tétel a Keretek oldalon is látszik.

---

## 1. A gazda döntései (2026-10-15)

| # | Döntés | Következmény |
|---|---|---|
| D1 | **Open Banking szolgáltató: Enable Banking** (Restricted Production, saját számlák) | ingyenes, magánszemélyes használat; a feltételek korlátai: §2.1 |
| D2 | **Erste és Revolut:** „nem baj" — ha elérhetők, jó; ha nem, nem blokkolják a munkát | a lista a spike-ban (A-40) derül ki; OTP/K&H/Raiffeisen/MBH az Enable HU-oldala szerint támogatott |
| D3 | **Külön oldal a bal oldali menüben** (`/bank`): Enable Banking link + állapot + lejárat-visszaszámlálás | §8 |
| D4 | **Lejárat-értesítések: kötelezőek, automatikusan bekapcsolva, NEM kapcsolhatók ki.** 150. napon „30 nap múlva frissíteni kell", onnan hetente, majd a **178., 179., 180.** napon is | §6 |
| D5 | **Lekérdezés: napi 1× (max.), inkább kevesebb** — nem a legpontosabb kell, hanem a biztonságos | §5.4 |
| D6 | **Mindkét forrás legyen meg** (Android értesítés + Enable Banking); az Android-lehetőség **szerepeljen az oldalon** (MacroDroid/Tasker **és** a natív app lehetősége) | v1: MacroDroid/Tasker; natív app = P2 (§10.4) |
| D7 | **Egy `advanced.md`**, két AI-ra bontva; a végén push gitre | §10 |
| D8 | **A gazda telefonja iPhone** (a MacroDroid/Tasker nem telepíthető) | a gazda saját keret-riasztásait az **Enable Banking napi szinkronja** adja → **nem azonnali** (legfeljebb ~1 napos késés); az Android-út (webhook) a többi, Androidos felhasználónak és eszköz nélkül (curl/automata teszt) fejleszthető, az útmutatója (B-43) **eszközön nem próbálható ki**, amíg nincs Android-készülék. Az azonnaliság iPhone-on csak a Parancsok-ötlettel (§2.4) lenne elérhető |
| D9 | **Az első valódi bank: Revolut (személyes számla), nem az OTP.** A Control Panel *ASPSP status* fülén (2026-10-15) a Revolut személyes számlák „no issues detected" (a sávon csak elvétve sárga), az OTP személyes számlák „possible issues detected" (a sáv bal oldalán sok piros, utána sárga) | az A-40 valódi-bankos szakasza Revolut-tal indul; az OTP-t is összekötjük és kipróbáljuk, de **a terv nem függ egyetlen banktól sem** (a lejárat, a szinkron, az egyeztetés bank-független); az átmeneti bank-kimaradást a szinkron-ablak tűri (§5.4) |

---

## 2. Amit tudni kell, mielőtt építünk (korlátok, őszintén)

### 2.1 Enable Banking — személyes használatra, nem „kiadható" szolgáltatás
- A [feltételeik](https://enablebanking.com/terms) szerint a Production környezet **Linked Accounts**-ra korlátozott, és **„solely … for the personal use of private individuals"**; üzleti/szakmai célra **nincs** licenc; a linkelt számlák száma korlátozott lehet; ingyenes. Üzleti használathoz külön szerződés + árazás kell.
- **Következmény:** az Enable-integráció **csak a gazdáé** (és ha kell, a saját számláit használó családtagoké, a feltételek szerint). A nyilvánosan regisztráló többi felhasználó **nem** használhatja az Enable-t. Ezért:
  - `profiles.bank_sync_allowed boolean default false` — **csak a gazda állíthatja** (SQL/admin-lépés; a kliens oszlop-allowlistjén **kívül**). Hamis → a `/bank` oldalon csak az Android-szakasz látszik, a „Bank-összekötés" helyén rövid magyarázat.
  - Ha az app egyszer nyilvános termék lesz: kereskedelmi szerződés az Enable-lel **vagy** másik szolgáltató (külön döntés, nem része ennek a körnek).
- **Restricted mód:** a Firefly III és az Actual Budget leírása szerint a saját számlákat előbb az Enable *Control Panelben* „linkelni" kell; csak a linkelt számlák érhetők el. Az Enable [dokumentációja](https://enablebanking.com/docs/api/linked-accounts/) szerint a linkelés **nem** helyettesíti az API-s hitelesítést („this process won't handle authorization on behalf of the app"): az alkalmazás a korlátozott módban is **saját `POST /auth` → `POST /sessions` folyamattal** kér hozzáférést, és az csak a linkelt számlákra működik. Ez tehát nagy valószínűséggel megy — de a **spike (A-40)** igazolja a gyakorlatban, mielőtt bármi épül rá (§10.1).

### 2.2 A hozzáférés lejár
A PSD2-hozzáférés bankonként más ideig érvényes (`maximum_consent_validity`; a példa-érték 180 nap). Lejárat után a bankot **újra kell hitelesíteni a bank saját appjában** (nem automatizálható) → ezért a **kötelező** lejárat-értesítések (§6).

### 2.3 Bank-hitelesítés
A magyar bankok többnyire **átirányításos** (redirect) folyamatot használnak; a felhasználónak sokszor **kézzel kell megnyitnia a bank mobilappját** a jóváhagyáshoz (az Enable HU-oldala szerint az automatikus app-váltás nem általános). A UI szövege ezt mondja ki.

### 2.4 Android értesítés-olvasás
- **Webes PWA nem olvashat más appok értesítéseit.** Kell egy Android-oldali közvetítő: **MacroDroid / Tasker** (v1), vagy egy **natív app** `NotificationListenerService`-szel (P2).
- A telefonon **külön engedély** kell („Értesítéshez hozzáférés"). Android 13+ alatt **oldalról telepített** (nem Play Store-os) appnál a rendszer „korlátozott beállítások" védelme is közbeszólhat — a natív app (P2) idején ellenőrizendő.
- Az akkumulátor-kímélő módok **leállíthatják** a közvetítőt → a UI-ban „Utolsó esemény: …" és hibaelhárítási szöveg.
- **iPhone-on nem lehetséges** (az iOS nem engedi más appok értesítéseinek olvasását). iPhone-nal: Enable Banking vagy kézi gyors kiadás.
  - *Kipróbálandó ötlet (P2, nem ígéret):* ha a bank a tranzakcióról **SMS-t vagy e-mailt** küld, az iOS **Parancsok** (Shortcuts) automatizálása reagálhat rá, és ugyanazt a webhookot hívhatja (§5.1). Push-értesítésre (bank-app) ez **nem** működik. Az A-40 spike-ban a gazda bankjánál ellenőrizendő, hogy van-e ilyen SMS/e-mail.

### 2.5 Az értesítés-szöveg érzékeny adat
Egy bank-push tartalmazhat egyenleget, számlaszám-töredéket. Ezért (**H3/H10/§9.4**): a feldolgozott tételből csak **összeg · pénznem · dátum · kereskedő** marad meg; a **nyers szöveget** csak a *feldolgozhatatlan* eseményeknél őrizzük, **14 napig**, hogy a felhasználó kézzel besorolhassa / a parser javítható legyen; utána törlődik. Banki hitelesítő adatot, kártyaszámot, teljes IBAN-t **nem** tárolunk.

---

## 3. Architektúra

```
                    ┌──────────────────────────── Android telefon ───────────────────────────┐
                    │ bank-app push ──► MacroDroid/Tasker (vagy P2: natív app)                │
                    └────────────────────────────┬────────────────────────────────────────────┘
                                                 │ HTTPS POST  (x-ingest-token)
                                                 ▼
 ┌─────────────────────────────┐        ┌───────────────────────────┐
 │ Enable Banking API          │◄──JWT──┤ Edge: ingest-notification │──┐
 │ (PSD2, saját számlák)       │        └───────────────────────────┘  │ parse → merchant→category
 └──────────────▲──────────────┘                                        ▼
                │ napi 1× (pg_cron → pg_net)             ┌────────────────────────────────┐
        ┌───────┴─────────┐                              │ bank_transactions  (főkönyv)   │
        │ Edge: bank-sync │─────── upsert ──────────────►│  source: notification | bank   │
        └───────▲─────────┘                              └───────────────┬────────────────┘
                │ code→session                                           │ reconcile (egyeztetés)
        ┌───────┴──────────────────────┐                                 ▼
        │ Edge: bank-connect-start /   │                     ┌────────────────────────┐
        │       bank-connect-finish    │                     │ expenses (a keretek    │
        └───────▲──────────────────────┘                     │ „élő számlálója")      │
                │ redirect                                   └───────────┬────────────┘
   ┌────────────┴───────────┐                                            │ check_budget_alert()
   │ Next.js  /bank oldal   │  (nincs titok a kliensben, H3)             ▼
   │ + /bank/callback       │                                  notifications (kind=budget)
   └────────────────────────┘                                  notifications (kind=bank_consent, KÖTELEZŐ)
                                                                         │
                                              meglévő csővezeték: send-notifications → push / in-app
```

**Elvek**
1. **Egy bemenet, egy kimenet:** minden forrás a `bank_transactions` főkönyvbe ír; onnan *származik* az `expenses` sor. A keretlogika (`budget_status`, tippek) **változatlanul** az `expenses`-ből számol.
2. **Titok csak szerveren (H3):** az Enable **privát kulcs** és az App ID kizárólag Edge Function secret. A Next.js-ben nincs titok; a callback-route a felhasználó sessionjével hív Edge Function-t.
3. **Idempotencia mindenhol:** ismételt webhook / ismételt szinkron nem hoz létre dupla tételt (`fingerprint UNIQUE`).
4. **Törölt tétel nem tér vissza:** a felhasználó által törölt kiadás a főkönyvben `dismissed` lesz; a következő szinkron nem hozza vissza.
5. **Pénz = `numeric`, összegzés SQL-ben (H9)**; pénznem-átváltás a meglévő `fx_convert`-tel.

---

## 4. Adatmodell (vázlat — az A-41 véglegesíti; mind RLS-sel, H4)

> Névkonvenció: `snake_case`, `text` + `check` (nem enum). Minden új tábla: `enable row level security` + policy + a két-felhasználós RLS-teszt (A-14 mintájára, mutációval ellenőrizve).

```sql
-- Profil-bővítés (a kliens oszlop-allowlistjén KÍVÜL: bank_sync_allowed; budget_alerts a listára kerül)
alter table public.profiles
  add column bank_sync_allowed boolean not null default false,   -- csak a gazda állítja (Enable ToS, §2.1)
  add column budget_alerts     boolean not null default true;    -- keret-riasztás kapcsoló (a lejárat-értesítésnek NINCS)

-- Webhook-tokenek (Android). A nyers token SOHA nem tárolódik: sha256-hash.
create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  token_hash text not null unique,            -- sha256(hex) — a token 192 bites véletlen
  prefix text not null,                       -- az első 6 karakter, a listához
  label text check (char_length(label) <= 40),
  allowed_apps text[] not null default '{}',  -- csomagnevek; üres = semmi nem engedett (biztonságos alap)
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Beérkezett események naplója (PII-mentes), ráta-korláthoz + „utolsó esemény"
create table public.ingest_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.ingest_tokens(id) on delete set null,
  app text,
  outcome text not null check (outcome in ('recorded','duplicate','ignored','unparsed','rejected')),
  raw_text text check (char_length(raw_text) <= 600),   -- CSAK outcome='unparsed'-nál; 14 nap után null/törlés
  at timestamptz not null default now()
);

-- Enable Banking kapcsolat (egy bank-hozzáférés = egy session)
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  provider text not null default 'enable_banking' check (provider = 'enable_banking'),
  aspsp_name text not null, aspsp_country char(2) not null,
  session_id text not null,                    -- az Enable session azonosítója (nem hitelesítő adat, de nem kerül a kliensre)
  accounts jsonb not null default '[]',        -- [{uid, iban_last4, currency, name}] — teljes IBAN NINCS
  authorized_at timestamptz not null,
  consent_valid_until timestamptz not null,    -- a bank tényleges lejárata (nem feltételezett 180 nap)
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  last_sync_at timestamptz, last_sync_ok boolean, last_error text,
  sync_count_today smallint not null default 0, sync_count_day date,   -- napi plafon őr (§5.4)
  created_at timestamptz not null default now()
);
-- + bank_connect_states(state, user_id, expires_at, used_at): CSRF-védő, egyszer használatos, 10 perc

-- Főkönyv: minden forrás tétele
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  source text not null check (source in ('notification','bank')),
  status text not null check (status in ('provisional','booked')),   -- notification = provisional; bank = booked
  amount numeric(14,2) not null check (amount > 0),                   -- v1: csak terhelés (debit)
  currency char(3) not null,
  booked_on date not null,                                            -- a profil időzónájában
  merchant text,                      -- normalizált (ékezet- és kisbetű-független kulcs: merchant_key)
  merchant_key text,
  category_id uuid references public.categories(id) on delete set null,
  fingerprint text not null,          -- lásd §5.3
  expense_id uuid references public.expenses(id) on delete set null,
  matched_with uuid references public.bank_transactions(id) on delete set null,
  dismissed boolean not null default false,   -- a felhasználó törölte → nem jön vissza
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

-- Kereskedő → kategória szabályok (a felhasználóé; a rendszer-alapok `user_id is null`, csak olvashatók)
create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  match_key text not null check (char_length(match_key) between 2 and 60),   -- merchant_key-re „tartalmazza"
  category_id uuid not null references public.categories(id) on delete cascade,
  hits int not null default 0,
  created_at timestamptz not null default now()
);

-- A meglévő táblák bővítése (additív, nem törő)
alter table public.expenses
  add column source text not null default 'manual' check (source in ('manual','notification','bank')),
  add column is_provisional boolean not null default false,
  add column merchant text check (char_length(merchant) <= 80);
alter table public.notifications drop constraint notifications_kind_check,
  add constraint notifications_kind_check check
  (kind in ('reminder','overdue','trial_end','digest','tip','news','system','budget','bank_consent'));
```

**Tombstone-szabály (trigger):** ha egy `expenses` sort a felhasználó töröl, és van hozzá `bank_transactions.expense_id`, a főkönyvi sor `dismissed = true`, `expense_id = null` lesz → a szinkron/webhook nem hozza vissza. (Guard-teszt kötelező.)

**Adatmegőrzés:** `ingest_events.raw_text` 14 nap; `ingest_events` sorok 60 nap; lejárt `bank_connect_states` 1 nap — a `cleanup_daily` jobba (A-50).

---

## 5. Szerződés — Edge Function-ök és folyamatok

> Az Edge Function-ök `verify_jwt = false` + **saját hitelesítés** (DECISIONS 2026-10-13): a webhook a **token-hash**, a cron a `x-cron-secret`, a felhasználói hívás a `auth.getUser(token)`. A válaszokban **nincs PII**, a logban sincs (`_shared/log.ts`).

### 5.1 `ingest-notification` (Android → webhook)

```
POST https://ddvzslgwexvdolovqqlg.supabase.co/functions/v1/ingest-notification
x-ingest-token: <nyers token, 1× látható a UI-ban>
Content-Type: application/json

{ "app": "<csomagnév>", "title": "<értesítés címe>", "text": "<értesítés szövege>",
  "posted_at": "2026-10-15T12:31:00+02:00" }              // posted_at opcionális (alap: szerver-idő)
```

Válasz: `200 { "ok": true, "status": "recorded" | "duplicate" | "ignored" | "unparsed" }` · `401` ismeretlen/visszavont token · `403` az `app` nincs az engedélyezettek között · `413` > 4 KB · `429` > 30 kérés/perc/token.

Lépések: (1) token-hash keresés (konstans idejű), `revoked_at is null` → (2) méret + ráta + app-allowlist → (3) **parse** (§5.2) → (4) `fingerprint` → `insert … on conflict do nothing` → (5) kereskedő→kategória szabály → (6) `expenses` sor (`source='notification'`, `is_provisional=true`) → (7) **`check_budget_alert`** (§7) → (8) `ingest_events` sor.
`ignored` = nem kiadás (jóváírás, egyenleg-értesítés, reklám); `unparsed` = kiadásnak látszik, de az összeg/kereskedő nem olvasható ki → a *Besorolásra vár* listába kerül (§8.4).

### 5.2 Parser (`_shared/parse-notification.ts`) — determinisztikus, **nincs LLM**
- Kimenet: `{ kind: 'debit' | 'credit' | 'other', amount, currency, merchant?, occurred_on? }`.
- Pénzformák: `4 500 Ft` · `4.500,00 HUF` · `12,50 EUR` · `€12.50` (HU/EN). Csak **terhelés** (vásárlás, kártyás fizetés, utalás kimenő, készpénzfelvétel) lesz kiadás; jóváírás/„egyenleg" → `ignored`.
- Bank-profilonként külön minta-lista (verziózva: `PARSER_VERSION`), a minták **fixture-ökből** épülnek. **A valódi push-szövegeket a gazda adja, anonimizálva** (összeg és kereskedő maradhat; egyenleg, számlaszám-töredék, név törlendő) — addig szintetikus, *jelölt* minták.
- LLM-es tartalék **nincs** (a szöveg harmadik félhez kerülne; ha egyszer kell: külön döntés + hozzájárulás).

### 5.3 Ujjlenyomatok és egyeztetés
- **Értesítés:** `sha256(user | app | normalizált_szöveg | posted_at percre kerekítve)` — a webhook-újrapróbálás és a frissülő (ugyanazt újraposztoló) értesítések kiszűrésére. *Ismert élhatár:* két teljesen azonos szövegű vásárlás ugyanabban a percben egynek számít (a banki szinkron ezt később helyreállítja).
- **Bank:** `sha256(user | connection | entry_reference)`; ha nincs referencia: `sha256(user | account | booking_date | amount | currency | remittance_hash | sorszám_a_napon)`.
- **Egyeztetés (`reconcile_bank_transactions`)** — egy banki (`booked`) tétel egy ideiglenes (`provisional`) értesítés-tétellel párosul, ha: azonos felhasználó · **azonos pénznem** · **azonos összeg** · a dátum ±3 nap · még nincs párja · **1:1** (a legközelebbi időpontú). Párosításkor az `expenses` sor **frissül** (nem jön létre új): `source='bank'`, `is_provisional=false`, pontos dátum/kereskedő; **a felhasználó által kézzel átsorolt kategória megmarad**. Nincs egyező pár → új `expenses` sor a banki tételből. Egy ideiglenes tétel, amelyhez 7 nap után sincs pár, **marad ideiglenes** (pl. olyan bank, amelyik nincs az Enable-ben — Revolut/Erste — de a push-ot olvassuk).

### 5.4 Enable Banking folyamatok
**Kapcsolat létrehozása** (`bank-connect-start` / `bank-connect-finish`, felhasználói JWT-vel, csak ha `bank_sync_allowed`):
1. UI: bank kiválasztása (`GET /aspsps?country=HU` szűrt lista, Edge-en át) → *Összekötés*.
2. `bank-connect-start`: `state` generálása (véletlen, 10 perc, egyszer használatos, `bank_connect_states`) → Enable `POST /auth` (kért érvényesség = a bank `maximum_consent_validity`-je) → visszaadja az átirányító URL-t.
3. A felhasználó a banknál jóváhagy → `GET {SITE}/bank/callback?code=…&state=…` (B route-ja: `app/(app)/bank/callback/route.ts` — session-ellenőrzés + `state` egyezés; az Enable-ben pontosan ez az útvonal van regisztrálva, §10.7).
4. `bank-connect-finish`: `POST /sessions` (code → session) → `bank_connections` sor: számlák **maszkolva**, `consent_valid_until` = a *valódi* lejárat → `rebuild_bank_consent_notifications` (§6) → első szinkron.
5. **Visszavonás:** `DELETE /sessions/{id}` + sor `revoked` + a lejárat-értesítések `cancelled`.

**Szinkron (`bank-sync`)** — biztonság az elsődleges:
- **Napi 1×** (`pg_cron`, `40 3 * * *` UTC ≈ éjszaka); **soha nem több**, mint **napi 2** hívás kapcsolatonként (automatikus + kézi együtt; a `sync_count_today` őr). Kézi „Frissítés most": legalább **12 óra** az előző szinkron óta.
- Csak **könyvelt (BOOK)** tételek (az ideiglenes bank-oldali tételeket az értesítés fedi). Lekérdezési ablak: az **utolsó *sikeres* szinkron − 3 nap**-tól (késve könyvelt tételek), lapozással — így a bank átmeneti kimaradása (D9) után a következő futás a kimaradt napokat is beolvassa; a sikertelen futás nem tolja előre az ablakot.
- Hibák: `401/403/422` (lejárt hozzáférés) → `status='expired'` + in-app értesítés; `429` → nincs újrapróbálkozás aznap; `5xx` → másnap újra; a hibaüzenet **PII-mentesen** a `last_error`-ba.
- A szinkron végén: `reconcile_bank_transactions` + `check_budget_alert` minden érintett kategóriára.
- Mezőnevek (Enable tranzakció-objektum: azonosító, összeg/pénznem, terhelés/jóváírás jelző, könyvelési dátum, kedvezményezett, közlemény) a **spike-ban véglegesítendők** — a dokumentáció alapján, nem találgatva.

---

## 6. Kötelező lejárat-értesítések (D4)

**Szabály:** minden aktív `bank_connections` sorhoz **automatikusan** készül 7 értesítés, **a tényleges lejárathoz (`consent_valid_until`) viszonyítva**:

| # | Mikor (lejárat előtt) | A 180 napos hozzáférés napja | Szöveg (HU / EN, lényeg) |
|---|---|---|---|
| 1 | **30 nap** | 150. nap | „30 nap múlva frissíteni kell a bank-hozzáférést." |
| 2 | 23 nap | 157. nap | „23 nap van hátra…" |
| 3 | 16 nap | 164. nap | „16 nap van hátra…" |
| 4 | 9 nap | 171. nap | „9 nap van hátra…" |
| 5 | **2 nap** | **178. nap** | „2 nap múlva lejár…" |
| 6 | **1 nap** | **179. nap** | „Holnap lejár…" |
| 7 | **0 nap** | **180. nap** | „Ma lejár — frissítsd, különben megáll az automatikus követés." |

(A heti ritmus 150-től 7 naponként: 150, 157, 164, 171, **178** — a 178. nap egybeesik a heti lépéssel; a 179. és 180. napi külön. Összesen 7.)

**Kötelezőség — pontosan mit jelent:**
- **Nincs kapcsoló** erre sehol (sem a Profilban, sem a `/bank` oldalon); a UI **lakat-ikonnal és szöveggel** mondja: „Kötelező értesítés — nem kapcsolható ki".
- **Nem érvényes rá** a `profiles.reminders_enabled = false`, a `channel_push = false` és a diszkrét mód *kikapcsolás-hatása*: a `claim_due_notifications` **kivételt tesz** a `kind = 'bank_consent'` sorokra (nem lesz `cancelled`).
- Csatorna: **in-app mindig** + **push**, ha van aktív feliratkozás. (Push-engedély nélkül a felhasználó az in-app értesítésközpontban és a `/bank` oldalon látja; e-mail tartalék: nyitott kérdés, §12 Q-ADV-2.)
- A push `url` mezője: `/bank`; a szöveg **nem tartalmaz érzékeny adatot** (csak a bank nevét és a hátralévő napot) → a diszkrét mód nem akadály.
- **Idő:** a profil időzónájában, a `default_notify_time`-kor (alap 09:00).
- **Rövidebb hozzáférés** (pl. egy bank 90 napot ad): a lépések *a lejárathoz* viszonyítottak, a már elmúlt lépések kimaradnak (a meglévő „24 óránál régebbi nem megy ki" szabály, §12.2/3. pont). Ha az első lépés is elmúlt, a kapcsolat létrehozásakor *azonnal* kimegy a „még N nap" értesítés.
- **Megújítás** (újra-hitelesítés): a régi sorok `cancelled`, az új lejáratból új 7 sor épül. **Visszavonás/törlés:** minden hátralévő sor `cancelled`.
- **Lejárat után:** `status='expired'`; a `/bank` oldal piros „Lejárt — frissítsd" kártyát mutat; az automatikus szinkron áll.
- **Egy forrás az eltolásokra:** `BANK_CONSENT_NOTIFY_DAYS_BEFORE = [30, 23, 16, 9, 2, 1, 0]` — SQL-ben (A) és `lib/constants.ts`-ben (B); egy **paritás-teszt** őrzi, hogy a kettő egyezik.

**Szerződés (új):** `notifications.kind = 'bank_consent'`; dedupe-kulcs: `bnk:<connectionId>:<validUntilDate>:<daysBefore>:<channel>`; payload: `{ bank, days_left, connection }`; függvény: `rebuild_bank_consent_notifications(p_connection_id, p_now default now())`.

---

## 7. Keret-riasztás (a gazda példája)

- **Mikor fut:** minden új/módosult `expenses` sor után (webhook, szinkron, kézi gyors kiadás is) — `check_budget_alert(p_user, p_category, p_month, p_now)`.
- **Mit számol:** a meglévő **`budget_status`** állapotait használja (`ok` / `watch` / `over`) — **új küszöböt nem vezetünk be**. Az ideiglenes (értesítés-eredetű) tétel **beleszámít** (ez a lényeg: azonnali jelzés).
- **Mikor küld:** állapot-**átlépéskor**, kategóriánként és hónaponként **szintenként egyszer**: `watch` (közel a kerethez) és `over` (túllépés). Dedupe: `bud:<userId>:<categoryId>:<yyyy-mm>:<watch|over>`. Ugyanabban a hónapban az újabb költés **nem** küld újabb `over`-t; a következő hónapban újra kezdődik.
- **Szöveg (HU/EN, `_shared/i18n.ts`):** *„Étterem: elfogyott a havi keret — 16 000 / 15 000 Ft."* (H10: nem tanács, csak tény; a „ne költs többet" jellegű felszólítást **nem** használjuk.) A `watch` szint: *„Étterem: a keret 87%-a elfogyott."*
- **Kapcsoló:** `profiles.budget_alerts` (alap be) — a Profil → Értesítések szakaszban. Független a `reminders_enabled`-től (a számla-emlékeztetők ki-/bekapcsolásától).
- **Csatorna:** in-app + push (a `channel_push` szerint). `url` → `/budgets/<kategória>`.
- **Nincs keret a kategóriára → nincs riasztás.** Besorolatlan tétel egy keretbe sem számít (ezért a *Besorolásra vár* lista, §8.4).

---

## 8. UI — az új `/bank` oldal (B)

### 8.1 Elhelyezés
- **Bal oldalsáv (≥ 1024 px):** új elem **„Bank-összekötés" / „Bank sync"** (lucide `Landmark`) a *Keretek* és *Megtakarítás* között. **Tablet:** az ikon-sínben. **Mobil:** a „Még" lapon.
- Az aktív szakasz az URL-ben: `/bank?section=overview|android|rules` (megosztható, frissítés-biztos; mobilon lista → részlet, asztalon belső nav — mint a Profil, §19.1).

### 8.2 `overview` — Bank-összekötés (Enable Banking)
- **Állapot-kártya** kapcsolatonként: bank neve · állapot (**ikon + szöveg**, nem csak szín: *Aktív* / *Hamarosan lejár* / *Lejárt* / *Hiba*) · **„N nap van hátra"** + sáv a hozzáférés teljes hosszából · utolsó szinkron időpontja és eredménye · gombok: **Újra-hitelesítés** (mindig elérhető) · **Frissítés most** (12 órás korlát, a magyarázattal) · **Kapcsolat törlése** (megerősítéssel).
- **Összekötés indítása:** nagy gomb „Összekötés az Enable Bankinggel" + **link az Enable Banking oldalára** (külső, `rel="noopener noreferrer"`; az URL egy konstans: `ENABLE_BANKING_URL` a `lib/constants.ts`-ben — a pontos Control Panel-cím a spike-ban ellenőrzendő) + 3 lépéses magyarázat (1. a bank kiválasztása · 2. a bank saját appjában jóváhagyod · 3. visszajössz, és kész) + a figyelmeztetés: *„A bank appját neked kell megnyitnod a jóváhagyáshoz."*
- **Kötelező értesítési ütemterv** (`ConsentTimeline`, szemantikus `<ol>`): a 7 lépés **dátummal** a tényleges lejáratból számolva, állapottal (*elküldve* ✔ / *következő* / *várható*), fölötte lakat + „**Kötelező — nem kapcsolható ki**". Ez az a „150. nap múlva… hetente… 178/179/180" ábra, amit a gazda kért.
- Ha `bank_sync_allowed = false`: rövid, őszinte szöveg (*„Ez a funkció jelenleg csak a fejlesztő saját számláira érhető el."*), a szakasz többi része rejtett; az Android-szakasz **teljes**.
- **Hozzáférhetőség (§14.14):** minden állapot ikon+szöveg; 44 px-es célok; az `aria-live` a szinkron-állapotra.

### 8.3 `android` — Android értesítés-olvasás (**a gazda kérésére itt szerepel**)
Két kártya egymás mellett (mobilon egymás alatt):

1. **MacroDroid / Tasker (most elérhető):**
   - *Webhook-token létrehozása* → a **nyers token egyszer** látszik (másolás-gomb, figyelmeztetés „később nem látod újra"); lista: előtag · címke · utolsó használat · **Visszavonás** / **Újragenerálás**.
   - Másolható **webhook-URL** és **JSON-sablon**.
   - **Lépésről lépésre útmutató** MacroDroidhoz és Taskerhez (a két app változó-nevei **nem találgatandók**: a *B-43* a hivatalos dokumentációból írja, és **„nem tesztelt eszközön"** jelzést kap, amíg egy Android-készüléken ki nem próbálták — a gazdának iPhone-ja van, D8).
   - **Engedélyezett appok**: csomagnév-lista szerkesztése (üres = semmi nem engedett); a „Legutóbb érkezett appok" listából egy koppintással hozzáadható.
   - **Teszt**: „Teszt-esemény küldése" → a felület megmutatja, megjött-e (az `ingest_events` alapján) és mit olvasott ki.
   - **Állapot:** „Utolsó esemény: 2 perce" / „Több mint 24 órája nem jött semmi — ellenőrizd a telefon akkumulátor-beállításait".
2. **Natív Android app (hamarosan):** `NotificationListenerService`-szel, külön alkalmazásként; ugyanazt a webhookot hívja → a szerver-oldal már kész. *Státusz: P2, a gazda döntésével (§10.4).* A kártya jelzi, hogy ez **még nem elérhető**, és hogy addig a MacroDroid/Tasker a javasolt út.

- **iPhone-jelzés** (a felhasználói platform alapján): *„iPhone-on az iOS nem engedi az értesítések olvasását — használd a Bank-összekötést vagy a gyors kiadást."*
- **Adatvédelmi sor:** mit tárolunk és mit nem (§2.5), és „Törlés" gomb az eseménynaplóra.

### 8.4 `rules` — Kereskedő-szabályok és *Besorolásra vár*
- **Besorolásra vár (N):** a besorolatlan és a feldolgozhatatlan (`unparsed`) tételek; egy koppintás: kategória választás + **„Ezt mindig így"** (szabályt hoz létre) · **„Ez nem kiadás"** (`dismissed`).
- **Szabályaim:** lista (kereskedő-minta → kategória, találatok száma), szerkesztés, törlés. A rendszer-alap szabályok (gyakori hazai éttermek/boltok kulcsszavai) **javaslatként** jelennek meg, felülírhatók; nem állítanak tényt a kereskedőkről.
- A Keretek → kategória-részleten a tételek mellett **„automatikus"** / **„ideiglenes"** jelvény (ikon + szöveg), és a törlés **Visszavonás**-t kínál.

### 8.5 Kapcsolódó változtatások
- **Profil → Értesítések:** új kapcsoló „Keret-riasztások"; új, **kapcsoló nélküli** sor: „Bank-hozzáférés lejárata — kötelező, mindig be" (lakat + magyarázat). A „Emlékeztetők be/ki" kapcsoló szövege kiegészül: *„A bank-hozzáférés lejárat-értesítései ettől függetlenül jönnek."*
- **Értesítésközpont (B-19) + `lib/notification-text.ts` + `public/sw.js`:** az új `budget` és `bank_consent` kind ikon/szöveg/mély link (`/budgets/<kat>`, `/bank`); a SW az ismeretlen `kind`-ot általánosan kezelje (a `paid`/`snooze` akciók csak `reminder`-hez).
- **Főoldal:** ha van kapcsolat és ≤ 30 nap van hátra → figyelmeztető sáv a `/bank` linkkel (ikon + szöveg).
- **Szövegek:** minden új felirat **HU és EN** (H8), új i18n-névtér: `bank`; `i18n:check` zöld.

---

## 9. Biztonság és adatvédelem (összegzés)

| Téma | Szabály |
|---|---|
| Enable privát kulcs, App ID | **csak** Edge secret (`ENABLE_APP_ID`, `ENABLE_PRIVATE_KEY`); **soha** fájl/repo/chat/log; a gazda állítja be a `db:secrets`/runbook szerint (A-47); a kulcsot nem küldi el nekem |
| Webhook-token | 192 bites véletlen; csak **hash** tárolva; egyszeri megjelenítés; visszavonható; ráta-korlát 30/perc; app-allowlist |
| `bank_sync_allowed` | csak a gazda állítja; a kliens oszlop-allowlistjén kívül; RLS-teszt mutációval |
| Callback | `state` egyszer használatos + 10 perc; a route a felhasználó sessionjét ellenőrzi; `Origin`-ellenőrzés a Server Action-ökön |
| Adatminimum | nincs teljes IBAN, egyenleg, kártyaszám; nyers szöveg csak `unparsed`-nál, 14 nap |
| RLS | minden új táblán; a felhasználó csak a sajátját látja; a `bank_transactions` / `bank_connections` írása **csak Edge/RPC** (service_role); `merchant_rules` és `expenses` közvetlen CRUD saját sorra |
| Törlés (GDPR) | `delete-account`: előbb az Enable-session `DELETE`, majd kaszkád; `export_my_data` kiegészül (a token-hash és a nyers szöveg **nélkül**) |
| Naplózás | PII-mentes (`_shared/log.ts`): sem összeg, sem kereskedő, sem szöveg |
| H10 | a UI és a jogi szövegek: az app **nem bank**, nem tanácsol; a `/privacy` bővül a bank-adat/értesítés-feldolgozás leírásával (TERVEZET jelzéssel, a gazda hagyja jóvá — §26-Q7) |

---

## 10. Feladatlista — két AI-ra bontva

> Jelölések: méret `S/M/L/XL` (§24); **Függ.** = a másik AI szállítmánya. Azonosítók: **A-40…A-52**, **B-40…B-48** (a meglévő A-31 / B-32 után; nincs ütközés). Commit: `[A] A-43: …` / `[B] B-41: …`. Kapuk (§22.2): typecheck 0 hiba · lint · i18n:check · test · **build**. Minden tartós szabályhoz mutációval ellenőrzött guard-teszt (H11).

### 10.1 Sorrend és szinkron-pontok

**A gazda (iPhone) útvonala az első — D8:** Enable Banking → kötelező lejárat-értesítések; az Android-út (webhook) vele **párhuzamosan**, eszköz nélkül tesztelhető backenddel halad.

```
 GAZDA-ÚT   S8b  Enable-összekötés + szinkron  ──►  S8c  Kötelező lejárat-értesítések
 ANDROID    S8a  webhook → kiadás → riasztás   (párhuzamos; curl/automata teszt, eszköz nélkül)

AI-A:  A-40 (spike, ELŐL) → A-41 → A-47 → A-48 → A-45 → A-46 → A-49 → A-50 → A-51 → A-52
         └─ párhuzamosan, az A-41 után: A-42 → A-44 → A-43   (Android-backend)
AI-B:  B-40 (váz) → B-41 → B-42 → B-45 → B-46 → B-47 → B-48
         └─ párhuzamosan: B-43 → B-44   (Android-szakasz + szabályok)
```
- **A-40 (spike) azonnal indul:** az Enable viselkedése (§2.1) minden S8b-munkát meghatároz; a sandbox-alkalmazás már kész (§10.7). **Az S8b feladatai a spike döntése előtt nem kezdődnek.**
- A **keret-riasztás (A-45)** forrás-független (az `expenses` táblára épül), ezért az A-41 után azonnal építhető és az Enable-szinkronnal is él.
- **S8a** (Android → riasztás) az Androidos felhasználóknak az **azonnali** út; a gazda iPhone-ján nem próbálható, ezért a B-43 útmutatója „nem tesztelt eszközön" jelzést kap, míg valaki Android-készülékkel ki nem próbálja.

| Sync | Mitől zöld | A szállít | B szállít | Közös teszt |
|---|---|---|---|---|
| **S8b** *(gazda-út, először)* | Enable-kapcsolat + napi szinkron + egyeztetés + keret-riasztás | A-40, A-41, A-45…A-48 | B-40, B-41 | §11 / T3, T4 (+ T1 az `expenses`-en át) |
| **S8c** | kötelező lejárat-értesítések + oldal-ütemterv | A-49…A-51 | B-42, B-45…B-48 | §11 / T5, T6 |
| **S8a** *(Android, párhuzamos)* | webhook → kiadás → keret-riasztás végig | A-42…A-44 | B-43, B-44 | §11 / T1, T2 |

### 10.2 AI-A feladatok (Platform) — `supabase/**`, scriptek, generált típusok

| ID | Feladat | Kimenet | Elfogadási kritérium | Méret | Függ. |
|---|---|---|---|---|---|
| **A-40** | **Enable Banking spike + ADR** | PoC **először a kész sandbox-alkalmazással** (Mock ASPSP, §10.7), utána — a gazda *Production*-alkalmazásával — valódi saját számlán (**először Revolut személyes számla**, utána OTP; D9); `DECISIONS.md` bejegyzés | Megválaszolva: (1) restricted módban az app-indította `/auth`→`/sessions` megy-e a linkelt számlákra; (2) a `GET /aspsps?country=HU` lista (OTP, Erste, Revolut, K&H, Raiffeisen, MBH); (3) bankonkénti max. hozzáférés-hossz; (4) a tranzakció-mezők; (5) JWT (RS256) aláírás Edge-en (könyvtár-döntés + indoklás, §25.7); (6) localhost/HTTPS redirect-szabály. Ha (1) **nem** megy → a gazda dönt a tartalékról (nem találgatunk). A privát kulcs csak env-ben | M | gazda (kézi: §10.3) |
| **A-41** | **Séma + RLS** (§4) | migráció(k): `ingest_tokens`, `ingest_events`, `bank_connections`, `bank_connect_states`, `bank_transactions`, `merchant_rules`, `profiles`/`expenses`/`notifications` bővítés, tombstone-trigger; `types/database.types.ts` újragenerálva | két-felhasználós RLS-teszt mind az új táblákra (mutációra bukik); `security_lint` zöld; `bank_sync_allowed` kliensről **nem** írható; törölt kiadás → `dismissed` | L | — |
| **A-42** | **Parser + kereskedő-szabályok** | `_shared/parse-notification.ts` (+ `PARSER_VERSION`), `seed/merchant_rules.sql` (javaslat-szintű rendszer-szabályok), normalizáló (`merchant_key`) | Deno-tesztek: HUF/EUR formák, terhelés vs. jóváírás, ismeretlen formátum → `unparsed`; **a fixture-ök a gazda anonimizált mintáiból** (addig jelölt szintetikus) | L | A-41 |
| **A-43** | **`ingest-notification` Edge Function** (§5.1) | függvény + `RUNBOOK`-bejegyzés | Deno-tesztek: érvényes token → `recorded`; ismétlés → `duplicate`; visszavont token 401; rossz app 403; > 4 KB 413; ráta 429; válaszban/logban nincs PII | L | A-41, A-42 |
| **A-44** | **Token-RPC-k** | `create_ingest_token(label, allowed_apps)` (nyers token **egyszer**), `revoke_ingest_token`, `list_ingest_tokens`, `set_ingest_apps` | a hash nem fordítható vissza; a lista nem ad nyers tokent; másik felhasználó tokenje nem kezelhető (RLS-teszt) | M | A-41 |
| **A-45** | **Keret-riasztás** (§7) | `check_budget_alert`, `notifications.kind='budget'`, szövegek HU/EN (`_shared/i18n.ts`), `profiles.budget_alerts` tiszteletben tartása | SQL-teszt (közvetlen `expenses`-beszúrással, webhook nélkül): 15 000 Ft keret + 16 000 Ft költés → **1** értesítés; újabb költés ugyanabban a hónapban → nincs új `over`; következő hónap → újra; keret nélküli / besorolatlan → nincs; `budget_alerts=false` → nincs | M | A-41 |
| **A-46** | **Egyeztetés** (§5.3) | `reconcile_bank_transactions(p_user, p_now)` | vektorok: azonos összeg ±3 nap → párosít; **két azonos kávé** ugyanazon a napon → 1:1; EUR/HUF nem keveredik; késői könyvelés; nincs pár → új kiadás; **átsorolt kategória megmarad**; `dismissed` nem éled újra | L | A-41, A-48 |
| **A-47** | **Enable-kapcsolat Edge Function-ök** (§5.4) | `bank-connect-start`, `bank-connect-finish`, `bank-disconnect`, `list-aspsps`; `_shared/enable.ts` (JWT, hívások); `ENABLE_*` secret-ek a `db:secrets`-be — **`--enable-key <fájl.pem>` kapcsoló: beolvassa a kulcsfájlt, secretként beállítja, a tartalmát soha nem írja ki** (§10.7) — + `RUNBOOK-secrets.md` | mock-Enable Deno-tesztek: `state` újrahasználat/lejárat elutasítva; `bank_sync_allowed=false` → 403; számlák maszkolva (nincs teljes IBAN); a válaszban/logban nincs titok | L | **A-40**, A-41 |
| **A-48** | **`bank-sync` + cron** | függvény + `pg_cron` job (`40 3 * * *`), `request_bank_sync` guard (12 óra, napi max 2) | mock-Enable tesztek: lapozás, 3 napos átfedés **az utolsó sikeres futástól** (egy sikertelen nap után a következő futás a kimaradt tételeket is hozza), 401/403/422 → `expired`, 429 → nincs újrapróba, 5xx → másnap; a napi plafon **nem** léphető túl (mutációra bukó teszt) | L | A-47 |
| **A-49** | **Kötelező lejárat-értesítések** (§6) | `rebuild_bank_consent_notifications`, `kind='bank_consent'`, **claim-kivétel** a kapcsolók alól, szövegek HU/EN, trigger a kapcsolat létrehozás/megújítás/törlés eseményre | SQL-teszt: a 7 sor a helyes napokon (30/23/16/9/2/1/0); `reminders_enabled=false` és `channel_push=false` mellett **mégis** kimegy; megújításkor a régiek `cancelled`; 90 napos hozzáférésnél a múltbéli lépések kimaradnak; a paritás-konstans egyezik a B-oldalival | M | A-41, A-47 |
| **A-50** | **Karbantartás + export + törlés** | `cleanup_daily` bővítés (nyers szöveg 14 nap, `ingest_events` 60 nap, lejárt `state`), `export_my_data` bővítés, `delete-account` (Enable-session `DELETE` + kaszkád), `ops_health` (utolsó szinkron, hibás kapcsolatok) | fiók-törlés után nincs maradék; export a token-hash/nyers szöveg nélkül | M | A-43, A-47 |
| **A-51** | **Biztonsági átnézés** (§9) | ellenőrzőlista kipipálva a `STATUS.md`-ben | RLS · token-kezelés · state/CSRF · secret-ek · logok · ráta-korlátok — nincs nyitott kritikus pont; `db:test` + `fn:test` + `fn:check` zöld | M | mind |
| **A-52** | **Szerződés-napló + típusok** | `CONTRACT_CHANGES.md` véglegesítés (RPC-k, kind-ok, payload-ok), `types/rpc.ts` | B `tsc` 0 hiba az új típusokkal | S | A-41…A-49 |

### 10.3 Gazda (kézi lépések) — az AI-k ezeket **nem** tudják megcsinálni

| # | Lépés | Mikor kell |
|---|---|---|
| G-1 | **Enable Banking Control Panel.** ✔ **Sandbox**-alkalmazás kész és *Active*, a privát kulcs (`.pem`) letöltve (§10.7). ☐ Hátra: **Production**-alkalmazás létrehozása + a **saját számláid linkelése** a Control Panelben — **először a Revolut (személyes számla, D9)**, utána az OTP (és az Erste, ha a listában megjelenik; a státusz-fülön a *personal accounts* sort nézd) — **az A-40 sandbox-szakasza után**, a spike eredményétől függően. A Production kulcsot is **csak** fájlként, `db:secrets`-szel add át; chatbe soha | A-40 (valódi bank) előtt |
| G-2 | ✔ **Redirect URL-ek** az Enable-ben regisztrálva: `https://bankreminder.vercel.app/bank/callback` és `http://localhost:3000/bank/callback` (§10.7). Hátra: a Vercel-deploy (B-27) és a `bankreminder.vercel.app` tényleges állapotának egyeztetése; a Production-alkalmazásnál ugyanezeket az URL-eket kell megadni | A-47 próbája előtt |
| G-3 | **Android** *(nem a gazdának — iPhone, D8)*: ha lesz Android-készülék (családtag/barát/tesztelő): MacroDroid *vagy* Tasker telepítése; „Értesítéshez hozzáférés" engedély; a bank-appok **csomagneveinek** kiolvasása (a UI „Legutóbb érkezett appok" listája segít). Addig a B-43 útmutatója „nem tesztelt eszközön" jelzésű | B-43 eszközös próbája |
| G-4 | **2–3 valódi bank-push szövegminta, anonimizálva** (egyenleg, számlaszám-töredék, név törölve; az összeg és a kereskedő maradhat) — a parser-tesztek ebből készülnek | A-42 |
| G-5 | **Jóváhagyások (H5):** `db:push`, Edge-deploy, `db:secrets` futtatása; `bank_sync_allowed = true` beállítása a saját fiókodra | minden telepítésnél |
| G-6 | **Jogi:** a `/privacy` bank-adat bekezdésének jóváhagyása (§26-Q7); döntés a natív Android appról (§10.4) | B-48 / P2 |

### 10.4 Natív Android app — **P2, csak a gazda döntésével**
Az `ingest-notification` szerződése miatt a szerver-oldal **már kész** (ugyanazt a webhookot hívja). Ami hiányzik: egy külön Android-projekt (`NotificationListenerService`, kiválasztott appok, ugyanaz a token) — új könyvtár (`android/**`), ezért **a §7.2 tulajdon-táblázat bővítése** és a gazda döntése kell (Kotlin vs. Capacitor; oldalról telepítés vs. Play Store, és az Android 13+ „korlátozott beállítások" kérdése, §2.4). Addig a MacroDroid/Tasker a támogatott út; a `/bank` oldal „hamarosan" kártyával jelzi.

### 10.5 AI-B feladatok (Experience) — `app/**`, `components/**`, `lib/**`, `locales/**`, `public/**`, `tests/**`

| ID | Feladat | Kimenet | Elfogadási kritérium | Méret | Függ. |
|---|---|---|---|---|---|
| **B-40** | **`/bank` váz + navigáció** | route (`?section=`), oldalsáv/ikon-sín/„Még" elem (`Landmark`), i18n-névtér `bank` (HU/EN), üres/betöltés/hiba állapotok, `bank_sync_allowed`-függő megjelenítés | 360/768/1280 px helyes; `aria-current`; `i18n:check` zöld; `bank_sync_allowed=false` → csak az Android-szakasz | M | A-41 |
| **B-41** | **Bank-összekötés szakasz** | állapot-kártya (hátralévő napok, utolsó szinkron), „Összekötés" Server Action → átirányítás, **`/bank/callback`** route (session + `state`; az Enable-ben regisztrált útvonal — **nem** `/api/…`), Enable-link, Újra-hitelesítés, Frissítés most (12 órás üzenet), Kapcsolat törlése (megerősítés), hibaleképezés | a teljes oldal-folyamat mock-szerverrel végigvihető; hibás/újrahasznált `state` → barátságos hiba; **nincs titok a kliens-csomagban** (bundle-ellenőrzés) | L | A-47 |
| **B-42** | **`ConsentTimeline` + lejárat-banner** | a 7 lépés dátummal (`<ol>`, ikon+szöveg állapot), lakat + „Kötelező — nem kapcsolható ki", Főoldal-sáv ≤ 30 napnál | a dátumok a szerver lejáratából; **paritás-teszt** a `BANK_CONSENT_NOTIFY_DAYS_BEFORE`-re (mutációra bukik); rövid (pl. 90 napos) hozzáférésnél helyes | M | A-41, A-49 |
| **B-43** | **Android-szakasz** | token létrehozás (egyszeri megjelenítés + másolás), webhook-URL + JSON-sablon, MacroDroid/Tasker útmutató (a hivatalos dokumentációból; **„nem tesztelt eszközön" jelzéssel**, amíg Android-készüléken nincs kipróbálva — D8), engedélyezett appok, „Legutóbb érkezett appok", Teszt-gomb, „Utolsó esemény", visszavonás/újragenerálás, **iPhone-jelzés**, „Natív app — hamarosan" kártya | a nyers token újratöltés után **nem** látszik; a teszt-esemény a felületen megjelenik; axe 0 serious/critical | L | A-43, A-44 |
| **B-44** | **Szabályok + *Besorolásra vár*** | lista + „Ezt mindig így" + „Ez nem kiadás", szabály-CRUD (`merchant_rules`), rendszer-javaslatok jelölése | átsorolás → szabály → a következő azonos kereskedő automatikusan besorolódik (e2e a DB-vel); törlés → `dismissed`, nem tér vissza | M | A-41, A-42 |
| **B-45** | **Keretek + értesítések integráció** | „automatikus"/„ideiglenes" jelvény a tétel-listán, törlés Visszavonással, új `budget`/`bank_consent` kind a `notification-text.ts`-ben, értesítésközpontban, `sw.js` általános `kind`-kezelés | a push-kattintás a `/budgets/<kat>` / `/bank` oldalra visz; a `paid`/`snooze` akció csak `reminder`-nél; unit + e2e | M | A-45, A-49 |
| **B-46** | **Profil → Értesítések** | „Keret-riasztások" kapcsoló (`budget_alerts`), kapcsoló nélküli „Bank-hozzáférés lejárata — kötelező" sor, az „Emlékeztetők be/ki" szöveg kiegészítése | a kötelező sor **nem** kapcsolható (nincs `<input>`); HU/EN; axe tiszta | S | A-41, A-49 |
| **B-47** | **Tesztcsomag** | e2e: webhook (teszt-token) → kiadás → riasztás a DB-ben; `/bank` axe világos/sötét + mobil 360 px; billentyűzet; unit: `state`/callback-védelem, token egyszeri megjelenítés, timeline-dátumok | minden új szabályhoz mutációra bukó guard-teszt; teljes `test:all` zöld | L | S8a–S8c |
| **B-48** | **Dokumentáció + jogi helyőrző** | README/CHANGELOG (1.1.0), `docs/DEPLOY-CHECKLIST.md` bővítés (Enable Control Panel, redirect URL, secret-ek, MacroDroid), „Hogyan működik?" súgó HU/EN, `/privacy` bekezdés (**TERVEZET**) | a checklist végigkövethető; a jogi szöveg a gazda jóváhagyásáig jelölt | S | B-41, B-43 |

### 10.6 Fájl-tulajdon (nincs átfedés)
- **A:** `supabase/migrations/*`, `supabase/functions/{ingest-notification,bank-connect-*,bank-disconnect,bank-sync,list-aspsps}/**`, `supabase/functions/_shared/{parse-notification,enable}.ts`, `supabase/seed/merchant_rules.sql`, `supabase/tests/*`, `scripts/*` (db:secrets), `types/database.types.ts`, `types/rpc.ts`.
- **B:** `app/(app)/bank/**` (benne a `callback/route.ts`), `components/bank/**`, `lib/bank/**`, `lib/constants.ts` (a közös konstans B oldala), `locales/*.json`, `public/sw.js`, `tests/**`.
- **Közös:** `docs/CONTRACT_CHANGES.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `.env.example`, ez a fájl. A `BANK_CONSENT_NOTIFY_DAYS_BEFORE` két helyen él (SQL + TS) — a paritás-teszt (B-42) őrzi.

### 10.7 Beállított környezet (2026-10-15) — a gazda lépései, amik már megvannak

| Elem | Állapot |
|---|---|
| **Enable Banking Control Panel** | ✔ fiók; az *API applications* fülön a **„Bank Reminder (sandbox)"** alkalmazás **Active** |
| **Alkalmazás-azonosító (App ID)** | `2b12a2bc-e5b5-49ad-9fb3-a51acd80d147` — *nem titok* (a JWT `kid` fejléce); a **sandbox**-hoz tartozik, a Production-nek külön lesz |
| **Környezet / szolgáltatások** | `SANDBOX` · *Account Information* ✔ · *Payment Initiation* (a Control Panel bekapcsolta — **mi nem használjuk**: az app soha nem indít fizetést, H10; a hívások csak a számla-információra szólnak) |
| **Redirect URL-ek** | `https://bankreminder.vercel.app/bank/callback` · `http://localhost:3000/bank/callback` (a dev-próbához a localhost is engedett — az A-40 spike-ban még ellenőrizendő, hogy a bank-oldali folyamat is elfogadja) |
| **Privát kulcs** | ✔ letöltve: `2b12a2bc-e5b5-49ad-9fb3-a51acd80d147.pem` (3,2 KB) a **repo gyökerében**. **Titok (H3)**: a `.gitignore` `*.pem` sora védi (`git check-ignore` igazolta, **nincs követve**); a tartalmát **senki nem olvasta ki és nem is fogja** (chat/repo/log tilos). Sorsa: az A-47 `db:secrets --enable-key <fájl>` Edge-secretként állítja be (`ENABLE_PRIVATE_KEY`), utána a fájl **a repo-mappán kívülre** kerül (a gazda jelszókezelőjébe/biztonságos helyre) |
| **Mock ASPSP** | a Control Panelben van egy *Mock ASPSP* fül → az A-40 és az A-47/A-48 fejlesztés **valódi bank nélkül** végigpróbálható a sandboxban |

**Mit jelent ez a tervre:**
1. Az **A-40 spike azonnal kezdhető** a sandbox-alkalmazással és a Mock ASPSP-vel — a gazdának nincs más dolga, mint jóváhagyni a futtatást (G-5).
2. A **valódi bankhoz** (OTP stb.) külön **Production**-alkalmazás kell, a saját számlák linkelésével (G-1) — ennek az App ID-ja és `.pem`-je **más** lesz; a sandbox-kulcs a valódi bankon nem használható.
3. A callback-útvonal **`/bank/callback`** (nem `/api/…`): a B route-ja ide épül (B-41), az `proxy.ts` védett-útvonal listájában a `/bank/**` bejelentkezést kér.
4. **Kulcs-higiénia:** ha a `.pem` bármikor gyanúsan kikerülne (chat, commit, log) → **azonnal új kulcsot** kell generálni a Control Panelben és a régit visszavonni.

---

## 11. Elfogadási forgatókönyvek (az S8a–c „kész" feltétele)

| # | Forgatókönyv | Elvárt eredmény |
|---|---|---|
| **T1** | *A gazda példája.* „Étterem" keret 15 000 Ft; webhook: 9 000 Ft kártyás vásárlás, majd 7 000 Ft | 2 kiadás (ideiglenes, „automatikus"); a **2. után 1 db** push *„Étterem: elfogyott a havi keret — 16 000 / 15 000 Ft"*; egy 3. költés **nem** küld újabb `over`-t |
| **T2** | *Idempotencia és törlés.* Ugyanaz a webhook kétszer; majd a felhasználó törli a kiadást; új webhook-ismétlés | 1 tétel; a törlés után a tétel **nem** éled újra |
| **T3** | *Egyeztetés.* Értesítés: 4 500 Ft ma; másnap a banki szinkron ugyanazt a 4 500 Ft-ot hozza | **1** kiadás marad, `source='bank'`, nem ideiglenes; a kézzel átsorolt kategória megmarad |
| **T4** | *Szinkron-biztonság.* Egy nap alatt 5 szinkron-kérés (cron + kézi) | legfeljebb **2** fut le; a 12 órás szabály betartva; 429 után aznap nincs újrapróba |
| **T5** | *Kötelező lejárat.* Kapcsolat `valid_until = most + 30 nap`; `reminders_enabled=false`, `channel_push=false` | 7 értesítés a 30/23/16/9/2/1/0. napon a lejárat előtt — **mégis kimegy**; a UI-ban nincs kapcsoló |
| **T6** | *Megújítás.* Újra-hitelesítés új lejárattal | a régi függő sorok `cancelled`; az új lejáratból új 7 sor |
| **T7** | *Jogosultság.* Másik (nem engedélyezett) felhasználó hívja a `bank-connect-start`-ot | 403; a `/bank` csak az Android-szakaszt mutatja; a két-felhasználós RLS-teszt zöld |
| **T8** | *Titokmentesség.* A kliens-csomag, a repo, a logok átvizsgálása | nincs `ENABLE_PRIVATE_KEY`, nincs nyers token, nincs összeg/kereskedő a logban |

---

## 12. Kockázatok és nyitott kérdések

### 12.1 Kockázatok

| ID | Kockázat | Ellenintézkedés |
|---|---|---|
| **R-ADV1** | Az Enable **restricted** mód nem engedi az app-indította összekötést, vagy a felhasználószám-/számlaszám-korlát szűk | **A-40 spike előbb**; S8a (Android) független, így az érték nem csúszik |
| **R-ADV2** | Az Enable-feltételek: csak személyes használat | `bank_sync_allowed` kapu (§2.1); nyilvános indulás előtt kereskedelmi szerződés vagy másik szolgáltató |
| **R-ADV3** | A bank-push szövege megváltozik → a parser nem ismeri fel | `PARSER_VERSION`; `unparsed` → *Besorolásra vár*; a banki szinkron akkor is pontosít; fixture-alapú tesztek |
| **R-ADV4** | Az akkumulátor-kímélés leállítja a MacroDroid/Taskert | „Utolsó esemény" + hibaelhárító szöveg; a banki szinkron helyreállítja a kimaradt tételeket |
| **R-ADV5** | Dupla tétel (push + banki) | ujjlenyomat + 1:1 egyeztetés (§5.3), vektor-tesztekkel |
| **R-ADV6** | A hozzáférés fél évente lejár, a felhasználó nem veszi észre | **kötelező** 7 lépéses értesítés (§6), in-app + push, Főoldal-sáv |
| **R-ADV7** | Az értesítés-szöveg érzékeny | adatminimum + 14 napos nyers-megőrzés (§2.5); jogi szöveg a gazda jóváhagyásával |
| **R-ADV8** | Supabase **Free**: szünetelés (R1) leállítja a szinkront és az értesítéseket | éles indulás előtt Pro (meglévő R1); a `ops_health` mutatja az utolsó szinkront |
| **R-ADV9** | PSD2 napi lekérdezés-korlát (túlhívás → 429) | napi 1× + napi max 2 őr; 429 → nincs újrapróba |

### 12.2 Nyitott kérdések a gazdának (alapérték félkövérrel — ha nem válaszolsz, ezzel haladunk)

| ID | Kérdés | Alapérték |
|---|---|---|
| **Q-ADV-1** | A többi regisztráló felhasználó is lássa-e az Enable-szakaszt? | **Nem** (csak az Android-rész) — az Enable ToS miatt |
| **Q-ADV-2** | A kötelező lejárat-értesítésekhez legyen-e e-mail tartalék (ha nincs push-engedély)? | **Nem** (csak push + in-app, ahogy kérted); ha igen: az utolsó 3 nap (178–180.) |
| **Q-ADV-3** | Az ideiglenes (értesítés-eredetű) tétel számítson-e a keretbe? | **Igen** (az azonnali riasztás miatt) |
| **Q-ADV-4** | Natív Android app (P2): Kotlin vagy Capacitor; oldalról telepítés vagy Play Store? | **Később** — előbb a MacroDroid/Tasker út bizonyít |
| **Q-ADV-5** | A rendszer-alap kereskedő-szabályok (pl. gyakori éttermek) induljanak-e javaslatként? | **Igen**, felülírható, jelölt |
| **Q-ADV-6** | A keret-riasztás `watch` szintje (közel a kerethez) is menjen-e push-ként, vagy csak az `over`? | **Mindkettő** (a meglévő `budget_status` állapotai szerint) |
| **Q-ADV-7** | iPhone-on a keret-riasztás a napi szinkronnal jön (≤ ~1 nap késés). Kell-e sűrűbb szinkron (pl. napi 2–3×)? | **Nem** — napi 1× (D5, biztonság); a PSD2 többet engedhet, de azt csak a spike (A-40) után, a bank 429-válaszait látva érdemes feljebb venni |
| **Q-ADV-8** | Kipróbáljuk-e az iOS Parancsok (Shortcuts) ötletet, ha a banktól jön SMS/e-mail a tranzakcióról? (§2.4) | **Később** (P2) — az A-40-ben csak azt nézzük meg, küld-e a bank ilyet |

---

## 13. Szerződés-változások — kivonat (a részletek: `docs/CONTRACT_CHANGES.md`)

- **Új táblák:** `ingest_tokens`, `ingest_events`, `bank_connections`, `bank_connect_states`, `bank_transactions`, `merchant_rules`.
- **Bővített táblák (additív, nem törő):** `profiles` (+`bank_sync_allowed`, +`budget_alerts`), `expenses` (+`source`, +`is_provisional`, +`merchant`), `notifications.kind` (+`budget`, +`bank_consent`).
- **Új RPC-k:** `create_ingest_token`, `revoke_ingest_token`, `list_ingest_tokens`, `set_ingest_apps`, `check_budget_alert`, `reconcile_bank_transactions`, `request_bank_sync`, `rebuild_bank_consent_notifications`.
- **Új Edge Function-ök:** `ingest-notification`, `bank-connect-start`, `bank-connect-finish`, `bank-disconnect`, `list-aspsps`, `bank-sync`.
- **Új route-ok (B):** `/bank`, `/bank/callback` (az Enable-ben regisztrált redirect URL).
- **Új cron job:** `bank_sync_daily` (`40 3 * * *` UTC).
- **Új secret-ek (csak Edge):** `ENABLE_APP_ID`, `ENABLE_PRIVATE_KEY`.
- **Új konstans (két helyen, paritás-teszttel):** `BANK_CONSENT_NOTIFY_DAYS_BEFORE = [30, 23, 16, 9, 2, 1, 0]`.
- **Változó viselkedés:** `claim_due_notifications` kivételt tesz a `bank_consent` sorokra (a felhasználói kapcsolók nem érvényesek rá).
- **Az ARCHITECTURE.md §1.3** „automatikus tranzakció-import" nem-célja erre a körre érvényét veszti; a §3 funkciólistába **F-30…F-33** kerül (Bank-összekötés · Android értesítés-olvasás · automatikus kiadás-felismerés · azonnali keret-riasztás) — a pontosítást a javaslattevő végzi az elfogadás után (§25.3/4).

---

## 14. Munkamenet-rutin ehhez a körhöz

1. **Indításkor** (mindkét AI): CLAUDE.md → ARCHITECTURE.md §2/§7/§25 → `docs/STATUS.md` → `docs/CONTRACT_CHANGES.md` → **ez a fájl** (a saját szakasz: §10.2 vagy §10.5).
2. **Sorrend:** A-40 (spike) és A-41 (séma) először; B-40 (váz) az A-41 típusaival indul, addig fixture-ökkel halad (§21.7).
3. **Zárásként:** `STATUS.md` frissítve (kész / folyamatban / blokkol), a következő lépés egy mondatban; szerződés-változás → `CONTRACT_CHANGES.md`.
4. **Soha:** titok kiírása (H3), vak `git add .`, `--force`/`--no-verify`, destruktív DB-művelet jóváhagyás nélkül (H5), a másik AI könyvtárába írás (H6), a ClimarkAI mappa/Supabase (H1/H2).
5. **Forrásmegjegyzés:** az Enable Banking feltételei és a magyar lefedettség a 2026-10-15-i átnézésen alapulnak ([Terms](https://enablebanking.com/terms), [HU-piac](https://enablebanking.com/docs/markets/hu/)); a **mezőnevek, bank-lista, hozzáférés-hossz és a restricted-mód viselkedése az A-40-ben igazolandó**, nem feltételezhető.
