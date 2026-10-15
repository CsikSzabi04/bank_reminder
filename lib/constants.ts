// Ismétlődő értékek egy helyen (§7.5)

// Profilkép: a szerver 2 MB fölött elutasít (a bucket is ennyit enged); a kliens 512 px-re vág, a szerver 256 px-re méretez
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_UPLOAD_SIZE = 512;
export const AVATAR_STORED_SIZE = 256;
export const AVATAR_BUCKET = "avatars";
// dekompressziós bomba ellen: ennél több pixeles bemenetet a sharp nem dolgoz fel
export const MAX_AVATAR_INPUT_PIXELS = 24_000_000;

// sessionStorage: a profil téma/nyelv szinkron bejelentkezésenként egyszer fut (§19.3)
export const PROFILE_SYNC_KEY = "br_profile_synced";

// Bank-hozzáférés lejárat-értesítései: ennyi nappal a lejárat ELŐTT megy értesítés (advanced.md §6, kötelező, nem kapcsolható ki).
// Az SQL-oldali (rebuild_bank_consent_notifications) listával egyeznie kell — a paritás-teszt őrzi (tests/unit/bank-consent.test.ts).
export const BANK_CONSENT_NOTIFY_DAYS_BEFORE = [30, 23, 16, 9, 2, 1, 0] as const;

// A bank-szinkron kézi „Frissítés most" gombjának korlátja (advanced.md §5.4): legalább ennyi óra az előző szinkron óta.
// A szabályt a szerver (request_bank_sync) tartja; ez csak a felület magyarázó szövegéhez kell.
export const BANK_MANUAL_SYNC_MIN_HOURS = 12;

// Az Enable Banking Control Panel (a saját számlák linkeléséhez, advanced.md §10.3 G-1); külső link, rel="noopener noreferrer"
export const ENABLE_BANKING_URL = "https://enablebanking.com/cp/applications";
