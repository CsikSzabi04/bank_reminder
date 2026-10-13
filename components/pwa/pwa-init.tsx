"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { captureInstallPrompt } from "@/components/install/install-store";
import { useToast } from "@/components/ui/toast";

const SW_URL = "/sw.js";

// Service worker regisztráció + frissítés-toast + a <html data-display-mode> jelző (§13.5).
// Fejlesztői módban NEM regisztrálunk (a cache-first statikus fájlok elavult kódot adnának), és a régit leiratkoztatjuk.
export function PwaInit() {
  const t = useTranslations("pwa");
  const toast = useToast();

  // a megjelenítési mód (standalone / böngésző): a CSS és a JS is ebből dönt (pl. "Maradjak bejelentkezve" rejtése)
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const apply = () => {
      const standalone = mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      document.documentElement.dataset.displayMode = standalone ? "standalone" : "browser";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // a telepítés-felkínálás (beforeinstallprompt) elkapása: egyszer sül el, el kell tárolni
  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
      void caches.keys().then((keys) => keys.filter((k) => k.startsWith("br-static-")).forEach((k) => void caches.delete(k)));
      return;
    }

    // Csak FRISSÍTÉSKOR töltünk újra (volt már irányító SW). Az első telepítés `clients.claim()`-je is
    // controllerchange-et vált ki: ott az oldal újratöltése felesleges és zavaró.
    let reloading = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const offerUpdate = (worker: ServiceWorker) =>
      toast.show({
        message: t("updateAvailable"),
        action: { label: t("update"), onClick: () => worker.postMessage("SKIP_WAITING") },
      });

    void navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // már várakozó új verzió (pl. másik fülön települt)
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          incoming?.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) offerUpdate(incoming);
          });
        });
      })
      .catch(() => {
        /* a PWA-funkciók nélkül az app így is működik */
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    // a toast és a fordító stabil; a regisztrációt csak egyszer akarjuk
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
