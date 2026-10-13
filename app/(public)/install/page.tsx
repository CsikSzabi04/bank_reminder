import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { InstallButton } from "@/components/install/install-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("install");
  return { title: t("title") };
}

const PLATFORMS = ["android", "ios", "desktop", "macSafari", "firefox"] as const;

export default async function InstallPage() {
  const t = await getTranslations("install");
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/install`;
  // PNG data-URI: nincs innerHTML, a CSP `img-src data:` engedi
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 224, color: { dark: "#0F1720", light: "#FFFFFF" } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-text-2">{t("lead")}</p>
        <div>
          <InstallButton />
        </div>
      </div>

      {/* asztali gépről a telefonra: QR (§13.3/4) */}
      <section aria-labelledby="qr-title" className="hidden items-center gap-5 rounded-card border border-border bg-surface p-5 shadow-card md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={t("qrAlt")} width={160} height={160} className="rounded-control border border-border bg-white" />
        <div>
          <h2 id="qr-title" className="text-lg font-semibold">
            {t("qrTitle")}
          </h2>
          <p className="text-text-2">{t("qrBody")}</p>
        </div>
      </section>

      <section aria-labelledby="platforms-title" className="flex flex-col gap-3">
        <h2 id="platforms-title" className="text-lg font-semibold">
          {t("platforms.title")}
        </h2>
        <dl className="flex flex-col gap-3">
          {PLATFORMS.map((p) => (
            <div key={p} className="rounded-card border border-border bg-surface p-4">
              <dt className="font-medium">{t(`platforms.${p}.name`)}</dt>
              <dd className="mt-1 text-text-2">{t(`platforms.${p}.steps`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
