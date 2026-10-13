"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AVATAR_UPLOAD_SIZE } from "@/lib/constants";

const VIEW = 288; // a kivágó nézet mérete px-ben
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const KEY_STEP = 12;

type Offset = { x: number; y: number };

// Négyzetes kivágó: húzás + nagyítás + nyílbillentyűk. A kimenet 512×512 WebP; a canvas eldobja az EXIF-et.
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const t = useTranslations("profile.crop");
  const tc = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointer: number; start: Offset; origin: Offset } | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // "from-image": az EXIF-tájolást a böngésző alkalmazza (álló fotó nem fekszik oldalt)
    createImageBitmap(file, { imageOrientation: "from-image" }).then(
      (b) => (cancelled ? b.close() : setBitmap(b)),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  // A kép rajzolt mérete: a rövidebb oldal tölti ki a négyzetet (cover), a zoom ezt nagyítja
  const geometry = (view: number, z: number, o: Offset) => {
    if (!bitmap) return null;
    const scale = (view / Math.min(bitmap.width, bitmap.height)) * z;
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    // a kivágás nem csúszhat ki a képből
    const maxX = Math.max(0, (w - view) / 2);
    const maxY = Math.max(0, (h - view) / 2);
    const x = Math.min(maxX, Math.max(-maxX, o.x * (view / VIEW)));
    const y = Math.min(maxY, Math.max(-maxY, o.y * (view / VIEW)));
    return { w, h, dx: (view - w) / 2 + x, dy: (view - h) / 2 + y };
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    const g = geometry(VIEW, zoom, offset);
    if (!ctx || !g || !bitmap) return;
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(bitmap, g.dx, g.dy, g.w, g.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap, zoom, offset]);

  const clampOffset = (o: Offset): Offset => {
    if (!bitmap) return o;
    const scale = (VIEW / Math.min(bitmap.width, bitmap.height)) * zoom;
    const maxX = Math.max(0, (bitmap.width * scale - VIEW) / 2);
    const maxY = Math.max(0, (bitmap.height * scale - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointer: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: offset };
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    setOffset(clampOffset({ x: d.origin.x + e.clientX - d.start.x, y: d.origin.y + e.clientY - d.start.y }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const move: Record<string, Offset> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    };
    const delta = move[e.key];
    if (!delta) return;
    e.preventDefault();
    setOffset((o) => clampOffset({ x: o.x + delta.x, y: o.y + delta.y }));
  };
  const onZoom = (value: number) => {
    setZoom(value);
    setOffset((o) => clampOffset(o));
  };

  const confirm = () => {
    const g = geometry(AVATAR_UPLOAD_SIZE, zoom, offset);
    if (!g || !bitmap) return;
    const out = document.createElement("canvas");
    out.width = out.height = AVATAR_UPLOAD_SIZE;
    out.getContext("2d")?.drawImage(bitmap, g.dx, g.dy, g.w, g.h);
    out.toBlob((blob) => blob && onConfirm(blob), "image/webp", 0.85);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="crop-title"
      onClose={onCancel}
      className="m-auto w-[min(92vw,360px)] rounded-card border border-border bg-surface p-5 text-text backdrop:bg-black/50"
    >
      <h2 id="crop-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-text-2">{t("hint")}</p>

      {failed ? (
        <p role="alert" className="mt-4 text-sm text-danger-text">
          {t("loadError")}
        </p>
      ) : (
        <>
          <div className="relative mx-auto mt-4" style={{ width: VIEW, height: VIEW }}>
            <canvas
              ref={canvasRef}
              width={VIEW}
              height={VIEW}
              tabIndex={0}
              role="img"
              aria-label={t("hint")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className="touch-none cursor-grab rounded-control bg-surface-2 active:cursor-grabbing"
            />
            {/* kör-előnézet: a körön kívüli rész elsötétül */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 0 999px rgb(0 0 0 / 0.45)", clipPath: "inset(0)" }}
            />
          </div>
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-text-2">
            {t("zoom")}
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
              className="accent-primary"
            />
          </label>
        </>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="min-h-11 rounded-control border border-border bg-surface px-4 font-medium"
        >
          {tc("cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!bitmap}
          className="min-h-11 rounded-control bg-primary px-4 font-medium text-primary-fg disabled:opacity-60"
        >
          {t("confirm")}
        </button>
      </div>
    </dialog>
  );
}
