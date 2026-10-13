import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import hu from "@/locales/hu.json";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
// a kivágó canvas/createImageBitmap-et igényel (jsdom-ban nincs): helyettesítjük egy egyszerű gombbal
vi.mock("@/components/profile/avatar-cropper", () => ({
  AvatarCropper: ({ onConfirm, onCancel }: { onConfirm: (b: Blob) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onConfirm(new Blob(["x"], { type: "image/webp" }))}>kivágás-ok</button>
      <button onClick={onCancel}>kivágás-mégse</button>
    </div>
  ),
}));

const OLD = "https://x.supabase.co/storage/v1/object/public/avatars/u/old.webp";
const NEW = "https://x.supabase.co/storage/v1/object/public/avatars/u/new.webp";

function setup(initialUrl: string | null = OLD, applyAccept = true) {
  const user = userEvent.setup({ applyAccept });
  const view = render(
    <NextIntlClientProvider locale="hu" messages={hu}>
      <AvatarUploader userId="u" name="Kiss Béla" initialUrl={initialUrl} />
    </NextIntlClientProvider>,
  );
  const fileInput = () => view.container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])')!;
  const img = () => screen.queryByRole("img", { name: "Kiss Béla profilképe" }) as HTMLImageElement | null;
  return { user, fileInput, img };
}

const pngFile = () => new File(["png"], "a.png", { type: "image/png" });

beforeEach(() => {
  refresh.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AvatarUploader", () => {
  it("sikeres feltöltés: az új kép látszik, a shell frissül, a kérés POST + multipart", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { path: "u/new.webp", url: NEW } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { user, fileInput, img } = setup();

    await user.upload(fileInput(), pngFile());
    await user.click(screen.getByText("kivágás-ok"));

    await waitFor(() => expect(img()?.src).toBe(NEW));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/profile/avatar");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.credentials).toBe("include");
    expect(refresh).toHaveBeenCalled();
  });

  it("szerverhiba: a régi kép visszaáll és a lokalizált üzenet megjelenik", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, reason: "type" }), { status: 415 })),
    );
    const { user, fileInput, img } = setup();

    await user.upload(fileInput(), pngFile());
    await user.click(screen.getByText("kivágás-ok"));

    expect(await screen.findByText("Csak JPG, PNG vagy WebP kép tölthető fel.")).toBeInTheDocument();
    expect(img()?.src).toBe(OLD);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("hálózati hiba: általános üzenet, a régi kép marad", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { user, fileInput, img } = setup();

    await user.upload(fileInput(), pngFile());
    await user.click(screen.getByText("kivágás-ok"));

    expect(await screen.findByText("Nem sikerült a képet menteni. Próbáld újra.")).toBeInTheDocument();
    expect(img()?.src).toBe(OLD);
  });

  it("nem kép típusú fájl: hiba, a kivágó meg sem nyílik, nincs hálózati hívás", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { user, fileInput } = setup(OLD, false); // az accept ne szűrjön: a kliens-ellenőrzést teszteljük

    await user.upload(fileInput(), new File(["x"], "a.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("Csak JPG, PNG vagy WebP kép tölthető fel.")).toBeInTheDocument();
    expect(screen.queryByText("kivágás-ok")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("törlés: DELETE hívás, a kép eltűnik (monogram marad)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { user, img } = setup();

    await user.click(screen.getByRole("button", { name: "Kép törlése" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/profile/avatar", expect.objectContaining({ method: "DELETE" })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Kép törlése" })).not.toBeInTheDocument());
    expect(img()?.tagName).toBe("SPAN"); // monogram, nem <img>
    expect(refresh).toHaveBeenCalled();
  });

  it("kép nélkül nincs „Kép törlése” gomb", () => {
    setup(null);
    expect(screen.queryByRole("button", { name: "Kép törlése" })).not.toBeInTheDocument();
  });
});
