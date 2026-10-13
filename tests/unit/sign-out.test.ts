// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signOut: vi.fn(),
  deleteCookie: vi.fn(),
}));

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/headers", () => ({ cookies: async () => ({ delete: state.deleteCookie, getAll: () => [] }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => ({ auth: { signOut: state.signOut } }) }));

import { signOut } from "@/lib/auth/sign-out";

const form = (entries: Record<string, string> = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  state.signOut.mockReset().mockResolvedValue({ error: null });
  state.deleteCookie.mockReset();
});

describe("signOut (§10.3)", () => {
  it("alapból csak ezt az eszközt jelentkezteti ki (scope: local), töröl és /login-ra visz", async () => {
    await expect(signOut(form())).rejects.toMatchObject({ url: "/login" });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(state.deleteCookie).toHaveBeenCalledWith("br_remember");
  });

  it("scope=global: minden eszközről", async () => {
    await expect(signOut(form({ scope: "global" }))).rejects.toMatchObject({ url: "/login" });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("ismeretlen scope nem csaphat át szélesebbre vagy furcsára (others, értelmetlen érték → local)", async () => {
    for (const scope of ["others", "everything", "GLOBAL", ""]) {
      state.signOut.mockClear();
      await expect(signOut(form({ scope }))).rejects.toBeInstanceOf(Redirect);
      expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
    }
  });
});
