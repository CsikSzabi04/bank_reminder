import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// A név nem lokalizálható futásidőben (márkanév); az app nyelve a felületen választható (§13.1)
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: "Számla- és előfizetés-emlékeztetők, költségkövetés, spórolási tippek.",
    lang: "hu",
    dir: "ltr",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.themeColor,
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Új emlékeztető", short_name: "Új", url: "/reminders/new?source=shortcut", icons: [{ src: "/icons/shortcut-add.png", sizes: "96x96" }] },
      { name: "Következő esedékesek", short_name: "Esedékes", url: "/reminders?source=shortcut" },
      { name: "Analitika", short_name: "Analitika", url: "/analytics?source=shortcut" },
    ],
    // Chrome „gazdag telepítő" ablak: 2 keskeny (mobil) + 1 széles (asztali) kép, kitalált minta-adatokkal (public/screenshots)
    screenshots: [
      { src: "/screenshots/dashboard-narrow.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Főoldal: havi kiadás és közelgő számlák" },
      { src: "/screenshots/reminders-narrow.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Emlékeztetők listája" },
      { src: "/screenshots/dashboard-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Főoldal asztali nézetben" },
    ],
  };
}
