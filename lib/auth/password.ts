export const PASSWORD_MIN_LENGTH = 8;

export type PasswordChecks = { length: boolean; letter: boolean; digit: boolean };

// A szabály a Supabase Auth beállításával egyezik (§10.5): ≥ 8 karakter, betű + szám
export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    letter: /\p{L}/u.test(password),
    digit: /\d/.test(password),
  };
}

export type PasswordStrength = "empty" | "weak" | "ok" | "strong";

// Egyszerű, determinisztikus erősség-jelző (nem jósolja a feltörhetőséget, csak irányt mutat)
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  const c = passwordChecks(password);
  if (!(c.length && c.letter && c.digit)) return "weak";
  const variety =
    Number(/\p{Ll}/u.test(password)) +
    Number(/\p{Lu}/u.test(password)) +
    Number(/[^\p{L}\d]/u.test(password));
  return password.length >= 12 && variety >= 2 ? "strong" : "ok";
}
