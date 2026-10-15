# Változásnapló

A formátum a [Keep a Changelog](https://keepachangelog.com/hu/1.1.0/) elvein, a verziózás a [SemVer](https://semver.org/lang/hu/) szabályain alapul.
A verziót a `package.json` adja; a `Profil → Névjegy` mutatja.

## [1.1.0] — 2026-10-15

Haladó kör: automatikus kiadás-felismerés bankból és értesítésből, azonnali keret-riasztás (terv: `advanced.md`).

### Hozzáadva
- **`/bank` oldal** (bal menü / „Még" lap): Összekötés · Android-értesítések · Szabályok; „Hogyan működik?" súgó (HU/EN).
- **Bank-összekötés (Enable Banking):** bank-választó, átirányítás a bank saját felületére, `/bank/callback` (paraméter-szűrés, egyszer használatos `state` a szerveren, `no-store`), kapcsolat-kártya (állapot ikonnal és szöveggel, hátralévő napok, utolsó szinkron), három számla-típus (folyószámla / más pénznem / IBAN nélküli megtakarítás — az IBAN nem számlakulcs), újra-hitelesítés, „Frissítés most" (12 órás korláttal), kapcsolat törlése megerősítéssel. A funkció a `bank_sync_allowed` kapuval csak az üzemeltetőé (az Enable feltételei miatt).
- **Kötelező lejárat-értesítések:** 30/23/16/9/2/1/0 nappal a lejárat előtt, nem kapcsolhatók ki (`ConsentTimeline`, Főoldal-sáv ≤ 30 napnál, kapcsoló nélküli sor a Profil → Értesítésekben).
- **Keret-riasztás:** értesítés, ha egy kategória havi kerete közel van a kimerüléshez vagy elfogyott; „Keret-riasztások" kapcsoló a Profilban.
- **Kereskedő-szabályok és „Besorolásra vár":** besorolás, „Ezt mindig így" (saját szabály + a várakozó azonos kereskedős tételek), „Ez nem kiadás" (nem tér vissza), szabály-CRUD, beépített javaslatok (javaslatként jelölve).
- **Tranzakciók** szakasz (`/bank?section=transactions`): a bank minden tétele — mit lett belőle (számla kifizetve / megtakarítás / kiadás + besorolás / jóváírás), szűrők, utolsó szinkron + „Frissítés most"; a Főoldalon egy „Bank: utolsó szinkron" sor.
- **Emlékeztető-link:** a Link mező az űrlap fő részében, „Megnyitás ↗" a Főoldalon, a listán, a részleten és az értesítésben (csak http/https, új lapon).
- **Bank-egyeztetés kulcsszó** (emlékeztető és megtakarítási cél): a banki terhelés a kulcsszó alapján kifizeti a számlát, illetve megtakarítási befizetésként könyvelődik; „Kifizetve a bankszámláról" jelzés az esedékességen.
- **Keretek:** az automatikusan felvett tételek „Automatikus" / „Ideiglenes" jelvényt kapnak; a kiadás törlése visszavonható.
- **Értesítések:** új fajták a központban (`budget`, `bank_consent`); a service worker a „Kifizettem/Halaszt" gombot csak számla-értesítésnél engedi.
- **Tesztek:** titok-őr (forrás + build kliens-csomag), callback-védelem, számla-típusok, hibaleképezés, A/B `merchant_key` paritás, élő DB-s e2e (szabály-CRUD, RPC-k), 360 px-es túlcsordulás-őr a komponens-játszótéren.

### Módosítva
- A „nem bank" közlemények (bejelentkezés, Névjegy, ÁSZF, adatkezelési tájékoztató) pontosítva: az app fizetést nem indít, bankszámlához csak olvasási hozzáférést kap, és csak ha te összekötöd. A jogi szövegek **TERVEZET** jelzésűek, az üzemeltető hagyja jóvá.

### Ismert korlátok
- Az **Android-út** (webhook, parser, MacroDroid/Tasker útmutató) a gazda anonimizált mintáira és Android-eszközre vár; iPhone-on az iOS nem engedi más appok értesítéseinek olvasását.
- A banki szinkron (napi egyeztetés) és az automatikus tételek az éles első futás után jelennek meg.

## [1.0.0] — 2026-10-15

Az első teljes kiadás (localhoston ellenőrizve; élesítés a gazda jóváhagyásával).

### Hozzáadva
- **Belépés és fiók:** regisztráció e-mail-megerősítéssel, belépés „Maradjak bejelentkezve" opcióval, elfelejtett jelszó, jelszó- és e-mail-módosítás, kijelentkezés minden eszközről, fiók törlése (szöveges megerősítéssel), onboarding (3 lépés).
- **Emlékeztetők:** katalógus-javaslatos űrlap, ismétlődés (egyszeri / heti / havi / éves / egyéni, hónap utolsó napja), értesítési időpontok, kifizetés / visszavonás / kihagyás / szüneteltetés, részletoldal, lista keresővel és szűrőkkel, minta-adatok.
- **Főoldal:** havi kiadás hero + kategória-fánk, hamarosan esedékes tételek, előfizetés-sáv, keretek, egy tipp, hír-sáv.
- **Naptár** hónap-rácsal és **ICS-feed** (token-rotációval).
- **Analitika:** KPI-k sparklinnal, kategória-fánk, havi trend, a hónap lefutása, top 5 tétel, kategóriák alakulása, következő 30 nap hőtérkép, előfizetés-költség, automatikus meglátások; Diagram ⇄ Táblázat nézet, időszak-választó.
- **Költségkeretek** és **gyors kiadás** (visszavonással), **megtakarítási célok** (befizetés / kivét / előzmények / archiválás, előkészített célok).
- **Tippek** (13 szabály, „Miért látom ezt?", Később / Nem érdekel / Megcsináltam) és **hírek** (kiadói RSS, forrással, dátummal, frissesség-jelzővel, jelentéssel).
- **Értesítések:** Web Push (VAPID) eszköz-kezeléssel, diagnosztikával és teszt-értesítéssel, in-app értesítésközpont, harang-számláló, app-jelvény, heti összefoglaló.
- **PWA:** telepíthető (manifest + képernyőképek), offline oldal, service worker (csak statikus fájlokat gyorsítótáraz), telepítés-gomb és útmutató.
- **Profil:** avatar (EXIF nélküli 256 px WebP), téma (világos/sötét/rendszer), nyelv (HU/EN), pénzügyek (pénznem, időzóna, jövedelem, saját kategóriák), adatexport (JSON/CSV), névjegy; kontrasztosabb diagramok és kevesebb mozgás kapcsoló.
- **Biztonság:** nonce-os CSP, szigorú fejlécek, RLS minden táblán, szerver-oldali validáció, CSV-injekció elleni védelem az exportban.
- **Hozzáférhetőség:** axe 0 serious/critical hiba minden oldalon (asztali világos/sötét + mobil), cél-méret ≥ 44 px, billentyűzet-használat, 320 px-es reflow.
- **Minőség:** ~370 unit-teszt, Playwright e2e (nyilvános, bejelentkezett, a11y, production CSP/PWA), i18n-ellenőrző (HU/EN paritás), kontraszt-teszt a design-tokenekre.

### Ismert korlátok
- A push és a telepítés valódi eszközön (Android, iPhone, Windows/Chrome, Brave) kézi ellenőrzést igényel.
- A fiók-törlés Edge Function-je és az e-mail-módosítás levele valódi, eldobható fiókkal ellenőrizendő.
- A hírek kiadói RSS-ből jönnek; az akciós tételeknél a feltételeket mindig az üzletnél kell ellenőrizni.
