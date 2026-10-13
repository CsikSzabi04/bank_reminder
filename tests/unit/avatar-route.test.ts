// @vitest-environment node
import sharp from "sharp";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A Supabase-klienst és a sütiket kicseréljük: a route logikáját (validáció, feldolgozás, feltöltés) teszteljük
const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  upload: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  previousPath: null as string | null,
}));

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    storage: { from: () => ({ upload: state.upload, remove: state.remove }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { avatar_path: state.previousPath } }) }) }),
      update: (values: unknown) => ({ eq: async () => state.update(values) }),
    }),
  }),
}));

import { DELETE, POST } from "@/app/api/profile/avatar/route";

const ORIGIN = "http://localhost:3000";

function request(body: BodyInit | null, init: { origin?: string | null; method?: string } = {}) {
  const headers = new Headers();
  const origin = init.origin === undefined ? ORIGIN : init.origin;
  if (origin) headers.set("origin", origin);
  return new NextRequest(`${ORIGIN}/api/profile/avatar`, { method: init.method ?? "POST", headers, body });
}

function form(bytes: Uint8Array | Buffer, name = "a.png", type = "image/png") {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return fd;
}

const png = () => sharp({ create: { width: 300, height: 200, channels: 3, background: "#ff0000" } }).png().toBuffer();

beforeEach(() => {
  state.user = { id: "user-1" };
  state.previousPath = null;
  state.upload.mockReset().mockResolvedValue({ error: null });
  state.remove.mockReset().mockResolvedValue({ error: null });
  state.update.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/profile/avatar", () => {
  it("bejelentkezés nélkül 401, semmi nem történik", async () => {
    state.user = null;
    const res = await POST(request(form(await png())));
    expect(res.status).toBe(401);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("idegen vagy hiányzó Origin → 403", async () => {
    expect((await POST(request(form(await png()), { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request(form(await png()), { origin: null }))).status).toBe(403);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("2 MB fölötti fájl → 413, nincs feltöltés", async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    const res = await POST(request(form(big)));
    expect(res.status).toBe(413);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("SVG / GIF / HTML (bármilyen MIME-mal) → 415, nincs feltöltés", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const gif = Buffer.from("GIF89a" + "x".repeat(40));
    for (const [bytes, name] of [[svg, "a.svg"], [gif, "a.gif"], [svg, "a.png"]] as const) {
      const res = await POST(request(form(bytes, name, "image/png")));
      expect(res.status).toBe(415);
      expect(await res.json()).toMatchObject({ code: "validation", reason: "type" });
    }
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("érvényes PNG a saját mappába töltődik WebP-ként, 256×256-ra méretezve", async () => {
    const res = await POST(request(form(await png())));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const [path, buffer, options] = state.upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.webp$/);
    expect(options).toMatchObject({ contentType: "image/webp", upsert: false, cacheControl: "3600" });
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([256, 256]);
    expect(state.update).toHaveBeenCalledWith({ avatar_path: path });
  });

  it("az EXIF-metaadat nem marad a feltöltött fájlban", async () => {
    const jpeg = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#00ff00" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "TITKOS-SZERZO" } })
      .toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined(); // a bemenetben van

    await POST(request(form(jpeg, "a.jpg", "image/jpeg")));
    const stored = state.upload.mock.calls[0][1] as Buffer;
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect(stored.includes(Buffer.from("TITKOS-SZERZO"))).toBe(false);
  });

  it("a régi képet törli, ha sikerült az új", async () => {
    state.previousPath = "user-1/regi.webp";
    await POST(request(form(await png())));
    expect(state.remove).toHaveBeenCalledWith(["user-1/regi.webp"]);
  });

  it("ha a profil frissítése bukik, az új fájlt eltakarítja és hibát ad", async () => {
    state.update.mockResolvedValue({ error: { message: "x" } });
    const res = await POST(request(form(await png())));
    expect(res.status).toBe(502);
    const uploadedPath = state.upload.mock.calls[0][0];
    expect(state.remove).toHaveBeenCalledWith([uploadedPath]);
  });

  it("sérült, de PNG-nek látszó fájl → 422", async () => {
    const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
    const res = await POST(request(form(broken)));
    expect(res.status).toBe(422);
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("nincs fájl a kérésben → 400", async () => {
    expect((await POST(request(new FormData()))).status).toBe(400);
  });
});

describe("DELETE /api/profile/avatar", () => {
  it("bejelentkezés nélkül 401, idegen Origin-nel 403", async () => {
    state.user = null;
    expect((await DELETE(request(null, { method: "DELETE" }))).status).toBe(401);
    state.user = { id: "user-1" };
    expect((await DELETE(request(null, { method: "DELETE", origin: "https://evil.example" }))).status).toBe(403);
  });

  it("nullázza az avatar_path-t és törli a fájlt", async () => {
    state.previousPath = "user-1/x.webp";
    const res = await DELETE(request(null, { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({ avatar_path: null });
    expect(state.remove).toHaveBeenCalledWith(["user-1/x.webp"]);
  });
});
