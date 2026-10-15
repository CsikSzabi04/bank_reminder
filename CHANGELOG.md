# Változásnapló

A formátum a [Keep a Changelog](https://keepachangelog.com/hu/1.1.0/) elvein, a verziózás a [SemVer](https://semver.org/lang/hu/) szabályain alapul.
A verziót a `package.json` adja; a `Profil → Névjegy` mutatja.

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
