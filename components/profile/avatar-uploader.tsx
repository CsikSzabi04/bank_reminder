"use client";

import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Notice } from "@/components/auth/notice";
import { Avatar } from "./avatar";
import { AvatarCropper } from "./avatar-cropper";

type ApiResult = { ok: true; data: { url: string | null } } | { ok: false; reason?: string };

const ERROR_KEY = {
  type: "errorType",
  size: "errorSize",
  image: "errorImage",
} as const;

// Profilkép: kiválasztás/fotózás → kivágás → szerver (§19.2). Optimista: az új kép azonnal látszik, hiba esetén visszaáll.
export function AvatarUploader({
  userId,
  name,
  initialUrl,
}: {
  userId: string;
  name: string | null;
  initialUrl: string | null;
}) {
  const t = useTranslations("profile.overview.avatar");
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<(typeof ERROR_KEY)[keyof typeof ERROR_KEY] | "errorGeneric" | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = ""; // ugyanazt a fájlt újra ki lehessen választani
    setError(null);
    // gyors, kliens-oldali előszűrés (a szerver a bájtokból újra ellenőriz)
    if (picked && !picked.type.startsWith("image/")) return setError("errorType");
    setFile(picked);
  };

  const send = async (request: () => Promise<Response>, optimistic: string | null) => {
    const previous = url;
    setBusy(true);
    setError(null);
    setUrl(optimistic);
    try {
      const res = await request();
      const body = (await res.json().catch(() => null)) as ApiResult | null;
      if (!res.ok || !body?.ok) {
        setUrl(previous);
        const reason = body && !body.ok ? body.reason : undefined;
        setError(reason && reason in ERROR_KEY ? ERROR_KEY[reason as keyof typeof ERROR_KEY] : "errorGeneric");
        return;
      }
      if ("data" in body) setUrl(body.data.url);
      router.refresh(); // a shell-ben lévő profilkép is frissüljön
    } catch {
      setUrl(previous);
      setError("errorGeneric");
    } finally {
      setBusy(false);
    }
  };

  const upload = (blob: Blob) => {
    setFile(null);
    const preview = URL.createObjectURL(blob);
    const form = new FormData();
    form.set("file", blob, "avatar.webp");
    void send(() => fetch("/api/profile/avatar", { method: "POST", body: form, credentials: "include" }), preview).then(
      () => URL.revokeObjectURL(preview),
    );
  };

  const remove = () =>
    send(() => fetch("/api/profile/avatar", { method: "DELETE", credentials: "include" }), null);

  const button =
    "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          userId={userId}
          name={name}
          url={url}
          size={96}
          alt={t("alt", { name: name ?? "" })}
          className="border border-border"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={busy} onClick={() => pickRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
            {busy ? t("uploading") : t("choose")}
          </button>
          {/* mobilon a kamerát nyitja meg; asztalon fájlválasztóként viselkedik */}
          <button type="button" className={button} disabled={busy} onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" aria-hidden />
            {t("take")}
          </button>
          {url && (
            <button type="button" className={button} disabled={busy} onClick={remove}>
              <Trash2 className="size-4" aria-hidden />
              {t("remove")}
            </button>
          )}
        </div>
      </div>

      <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
      <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={onPick} />

      {error && <Notice variant="error">{t(error)}</Notice>}
      <div aria-live="polite" className="sr-only">
        {busy ? t("uploading") : ""}
      </div>

      {file && <AvatarCropper file={file} onCancel={() => setFile(null)} onConfirm={upload} />}
    </div>
  );
}
