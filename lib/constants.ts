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
