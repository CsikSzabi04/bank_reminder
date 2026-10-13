import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { avatarUrl, detectImageType } from "@/lib/avatar";
import {
  AVATAR_BUCKET,
  AVATAR_STORED_SIZE,
  MAX_AVATAR_BYTES,
  MAX_AVATAR_INPUT_PIXELS,
} from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";

// A sharp natív modul → Node futásidő (nem Edge)
export const runtime = "nodejs";

type Reason = "invalid" | "type" | "size" | "image";

const fail = (status: number, code: string, reason?: Reason) =>
  NextResponse.json({ ok: false, code, reason }, { status, headers: { "Cache-Control": "no-store" } });

const sameOrigin = (request: NextRequest) => request.headers.get("origin") === request.nextUrl.origin;

// Profilkép feltöltése (§19.2). A kliens NEM ír közvetlenül a Storage-ba: a szerver ellenőriz, újraméretez és tisztít.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail(403, "forbidden");

  const supabase = createClient(await cookies());
  // az identitás a szerveren ellenőrzött session-ből jön (nem a kérésből)
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return fail(401, "unauthenticated");

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return fail(400, "validation", "invalid");
  }
  if (!(file instanceof File)) return fail(400, "validation", "invalid");
  // a File.size a parser által mért tényleges hossz; a típust a bájtokból állapítjuk meg (nem a MIME-ból)
  if (file.size > MAX_AVATAR_BYTES) return fail(413, "validation", "size");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!detectImageType(bytes)) return fail(415, "validation", "type");

  let output: Buffer;
  try {
    // újrakódolás: kiszűri a beágyazott tartalmat; a sharp alapból eldobja az EXIF/metaadatot (nincs withMetadata)
    output = await sharp(bytes, { limitInputPixels: MAX_AVATAR_INPUT_PIXELS })
      .rotate() // az EXIF-tájolás beégetése, mielőtt a metaadat elvész
      .resize(AVATAR_STORED_SIZE, AVATAR_STORED_SIZE, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return fail(422, "validation", "image");
  }

  // a felhasználó JWT-jével töltünk fel: a Storage RLS a saját mappára korlátoz
  const path = `${uid}/${crypto.randomUUID()}.webp`;
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { error: uploadError } = await bucket.upload(path, output, {
    contentType: "image/webp",
    cacheControl: "31536000", // a fájlnév UUID: új feltöltés = új URL, a régi örökre cache-elhető
    upsert: false,
  });
  if (uploadError) return fail(502, "upstream_failed");

  const { data: previous } = await supabase.from("profiles").select("avatar_path").eq("id", uid).single();
  const { error: updateError } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", uid);
  if (updateError) {
    await bucket.remove([path]); // ne maradjon gazdátlan fájl
    return fail(502, "upstream_failed");
  }

  if (previous?.avatar_path) await bucket.remove([previous.avatar_path]); // régi kép törlése (best effort)
  return NextResponse.json(
    { ok: true, data: { path, url: avatarUrl(path) } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return fail(403, "forbidden");

  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return fail(401, "unauthenticated");

  const { data: previous } = await supabase.from("profiles").select("avatar_path").eq("id", uid).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", uid);
  if (error) return fail(502, "upstream_failed");

  if (previous?.avatar_path) await supabase.storage.from(AVATAR_BUCKET).remove([previous.avatar_path]);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
