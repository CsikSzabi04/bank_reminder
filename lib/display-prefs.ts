// Megjelenés-beállítások (Profil → Megjelenés): eszköz-szintűek, a localStorage-ban élnek; a <html> data-attribútuma hat a CSS-re.
// A localStorage hiányozhat / dobhat (privát ablak, tiltott süti) → minden hozzáférés védett, az alapérték „ki".
export const PREF_KEYS = {
  contrastCharts: { storage: "br_contrast_charts", attr: "contrastCharts" },
  reduceMotion: { storage: "br_reduce_motion", attr: "reduceMotion" },
} as const;
export type PrefName = keyof typeof PREF_KEYS;

export const PREFS_EVENT = "br:prefs";

export function readPref(name: PrefName): boolean {
  try {
    return window.localStorage.getItem(PREF_KEYS[name].storage) === "1";
  } catch {
    return false;
  }
}

export function applyPref(name: PrefName, on: boolean): void {
  const { attr } = PREF_KEYS[name];
  if (on) document.documentElement.dataset[attr] = "1";
  else delete document.documentElement.dataset[attr];
}

export function writePref(name: PrefName, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(PREF_KEYS[name].storage, "1");
    else window.localStorage.removeItem(PREF_KEYS[name].storage);
  } catch {
    /* a beállítás ekkor csak az oldal életére érvényes */
  }
  applyPref(name, on);
  window.dispatchEvent(new Event(PREFS_EVENT));
}
