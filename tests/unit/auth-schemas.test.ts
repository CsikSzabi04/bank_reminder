import { describe, expect, it } from "vitest";
import { passwordChecks, passwordStrength } from "@/lib/auth/password";
import {
  confirmSchema,
  emailOnlySchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/schemas/auth";

const errorsOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.message);

describe("jelszó-szabály (§10.2/§10.5: ≥ 8, betű + szám)", () => {
  it("ellenőrzések", () => {
    expect(passwordChecks("abc")).toEqual({ length: false, letter: true, digit: false });
    expect(passwordChecks("12345678")).toEqual({ length: true, letter: false, digit: true });
    expect(passwordChecks("Abcdefg1")).toEqual({ length: true, letter: true, digit: true });
  });
  it("ékezetes betű is betű", () => {
    expect(passwordChecks("árvíztűrő1").letter).toBe(true);
  });
  it("erősség: gyenge / megfelelő / erős", () => {
    expect(passwordStrength("")).toBe("empty");
    expect(passwordStrength("abc")).toBe("weak");
    expect(passwordStrength("Abcdefg1")).toBe("ok");
    expect(passwordStrength("Abcdefghijk1!")).toBe("strong");
  });
});

describe("signUpSchema", () => {
  const valid = { displayName: "Elek", email: "a@b.hu", password: "Abcdefg1", locale: "hu", accept: "on" };

  it("érvényes adat átmegy, az e-mail trimmelve", () => {
    const r = signUpSchema.safeParse({ ...valid, email: "  a@b.hu " });
    expect(r.success && r.data.email).toBe("a@b.hu");
  });
  it("elfogadás nélkül bukik", () => {
    expect(errorsOf(signUpSchema.safeParse({ ...valid, accept: undefined }))).toContain("acceptRequired");
  });
  it("hosszú név, rossz e-mail, ismeretlen nyelv", () => {
    expect(errorsOf(signUpSchema.safeParse({ ...valid, displayName: "x".repeat(61) }))).toContain("tooLong");
    expect(errorsOf(signUpSchema.safeParse({ ...valid, email: "nem-email" }))).toContain("invalidEmail");
    expect(signUpSchema.safeParse({ ...valid, locale: "de" }).success).toBe(false);
  });
  it("gyenge jelszó mind a hiányzó szabályt jelzi", () => {
    expect(errorsOf(signUpSchema.safeParse({ ...valid, password: "abc" }))).toEqual(
      expect.arrayContaining(["passwordLength", "passwordDigit"]),
    );
  });
});

describe("signInSchema / emailOnlySchema", () => {
  it("belépéskor nem erősségi szabály, csak nem üres", () => {
    expect(signInSchema.safeParse({ email: "a@b.hu", password: "x" }).success).toBe(true);
    expect(errorsOf(signInSchema.safeParse({ email: "a@b.hu", password: "" }))).toContain("required");
  });
  it("a remember jelölőnégyzet logikai értékké alakul", () => {
    const on = signInSchema.safeParse({ email: "a@b.hu", password: "x", remember: "on" });
    const off = signInSchema.safeParse({ email: "a@b.hu", password: "x" });
    expect(on.success && on.data.remember).toBe(true);
    expect(off.success && off.data.remember).toBe(false);
  });
  it("e-mail kötelező", () => {
    expect(errorsOf(emailOnlySchema.safeParse({ email: "" }))).toContain("required");
  });
});

describe("updatePasswordSchema", () => {
  it("eltérő jelszavak → mismatch a confirm mezőn", () => {
    const r = updatePasswordSchema.safeParse({ password: "Abcdefg1", confirm: "Abcdefg2" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.find((i) => i.message === "mismatch")?.path).toEqual(["confirm"]);
  });
  it("egyező, erős jelszó átmegy", () => {
    expect(updatePasswordSchema.safeParse({ password: "Abcdefg1", confirm: "Abcdefg1" }).success).toBe(true);
  });
});

describe("confirmSchema", () => {
  it("csak ismert típus és érdemi token fogadható el", () => {
    expect(confirmSchema.safeParse({ token_hash: "abcdefghijk", type: "recovery" }).success).toBe(true);
    expect(confirmSchema.safeParse({ token_hash: "abcdefghijk", type: "admin" }).success).toBe(false);
    expect(confirmSchema.safeParse({ token_hash: "rovid", type: "signup" }).success).toBe(false);
    expect(confirmSchema.safeParse({ type: "signup" }).success).toBe(false);
  });
});
