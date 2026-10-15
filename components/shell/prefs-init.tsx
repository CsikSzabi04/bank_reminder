"use client";

import { useEffect } from "react";
import { PREF_KEYS, PREFS_EVENT, applyPref, readPref, type PrefName } from "@/lib/display-prefs";

// A mentett megjelenés-beállítások alkalmazása betöltéskor és másik fülön történt módosításkor (storage esemény)
export function PrefsInit() {
  useEffect(() => {
    const apply = () => (Object.keys(PREF_KEYS) as PrefName[]).forEach((name) => applyPref(name, readPref(name)));
    apply();
    window.addEventListener("storage", apply);
    window.addEventListener(PREFS_EVENT, apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener(PREFS_EVENT, apply);
    };
  }, []);
  return null;
}
