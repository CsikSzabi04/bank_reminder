// i18n védőkorlátok (§20.1, H8): hu/en kulcs-paritás, ICU-argumentumok egyezése,
// használt-de-hiányzó kulcs. A nyers JSX-szöveget az ESLint (react/jsx-no-literals) fogja.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_DIRS = ["app", "components", "lib"];
const SOURCE_EXT = /\.(ts|tsx)$/;

export function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

// A `{`-hez tartozó záró `}` indexe (beágyazással); -1, ha nincs
function matchingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

const ICU_OPTION_TYPES = new Set(["plural", "select", "selectordinal"]);

function collectArgs(text, names) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    const end = matchingBrace(text, i);
    if (end < 0) return;
    const inner = text.slice(i + 1, end);
    const comma = inner.indexOf(",");
    if (comma === -1) {
      names.add(inner.trim()); // {name}
    } else {
      names.add(inner.slice(0, comma).trim()); // {n, plural, …}
      const rest = inner.slice(comma + 1);
      const second = rest.indexOf(",");
      if (second !== -1 && ICU_OPTION_TYPES.has(rest.slice(0, second).trim())) {
        // az ágak ("one {…} other {…}") tartalma külön üzenet: abban is lehet argumentum, a puszta szó nem az
        const body = rest.slice(second + 1);
        for (let j = 0; j < body.length; j++) {
          if (body[j] !== "{") continue;
          const close = matchingBrace(body, j);
          if (close < 0) break;
          collectArgs(body.slice(j + 1, close), names);
          j = close;
        }
      }
    }
    i = end;
  }
}

// ICU-argumentumnevek: {name}, {n, plural, one {# nap} other {…}} → "name", "n"; az ágak szövege nem argumentum
export function icuArgs(message) {
  const names = new Set();
  collectArgs(message, names);
  return [...names].sort();
}

export function checkParity(hu, en) {
  const errors = [];
  const huKeys = Object.keys(hu);
  const enKeys = new Set(Object.keys(en));
  for (const k of huKeys) if (!enKeys.has(k)) errors.push(`EN-ből hiányzik: ${k}`);
  for (const k of enKeys) if (!(k in hu)) errors.push(`HU-ból hiányzik: ${k}`);
  for (const k of huKeys) {
    if (!(k in en)) continue;
    for (const [lang, msgs] of [["HU", hu], ["EN", en]]) {
      if (typeof msgs[k] !== "string" || msgs[k].trim() === "") errors.push(`${lang}: üres érték: ${k}`);
    }
    if (typeof hu[k] === "string" && typeof en[k] === "string") {
      const a = icuArgs(hu[k]).join(",");
      const b = icuArgs(en[k]).join(",");
      if (a !== b) errors.push(`ICU-argumentumok eltérnek (${k}): HU {${a}} ≠ EN {${b}}`);
    }
  }
  return errors;
}

// Egy forrásfájlban a fordító-változók (const t = useTranslations("ns")) és a t("kulcs") hívások.
// Ugyanaz a változónév több függvényben is szerepelhet más névtérrel → a hívás a legközelebbi
// MEGELŐZŐ deklarációhoz tartozik.
export function extractUsedKeys(source) {
  const used = []; // { key } teljes kulcs | { prefix } dinamikus
  const declarations = new Map(); // név → [{ index, ns }]
  const decl = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:["']([^"']*)["'])?\s*\)/g;
  for (const m of source.matchAll(decl)) {
    const list = declarations.get(m[1]) ?? [];
    list.push({ index: m.index, ns: m[2] ?? "" });
    declarations.set(m[1], list);
  }
  for (const [name, list] of declarations) {
    const call = new RegExp(`(?<![\\w.])${name}\\(\\s*(["'\`])([^"'\`]*)\\1`, "g");
    for (const m of source.matchAll(call)) {
      const owner = [...list].reverse().find((d) => d.index < m.index);
      if (!owner) continue;
      const raw = m[2];
      const dyn = raw.indexOf("${");
      const full = (rel) => (owner.ns ? `${owner.ns}.${rel}` : rel);
      if (dyn === -1) used.push({ key: full(raw) });
      else if (dyn > 0) used.push({ prefix: full(raw.slice(0, dyn)) });
    }
  }
  return used;
}

export function checkUsage(usedBySource, keys) {
  const errors = [];
  const keySet = new Set(keys);
  for (const [file, used] of usedBySource) {
    for (const u of used) {
      if (u.key && !keySet.has(u.key)) errors.push(`${file}: használt, de hiányzó kulcs: ${u.key}`);
      if (u.prefix && !keys.some((k) => k.startsWith(u.prefix))) {
        errors.push(`${file}: nincs kulcs a(z) "${u.prefix}…" előtaggal`);
      }
    }
  }
  return errors;
}

// ROOT csak futtatáskor kell (a teszt jsdom-környezetben nem file: URL-t kap)
const rootDir = () => fileURLToPath(new URL("..", import.meta.url));

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (SOURCE_EXT.test(name) && !name.endsWith(".d.ts")) files.push(path);
  }
  return files;
}

function main() {
  const ROOT = rootDir();
  const load = (lang) => flatten(JSON.parse(readFileSync(join(ROOT, "locales", `${lang}.json`), "utf8")));
  const hu = load("hu");
  const en = load("en");
  const errors = checkParity(hu, en);

  const usedBySource = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const used = extractUsedKeys(readFileSync(file, "utf8"));
      if (used.length) usedBySource.push([relative(ROOT, file).replaceAll("\\", "/"), used]);
    }
  }
  errors.push(...checkUsage(usedBySource, Object.keys(hu)));

  if (errors.length) {
    console.error(`i18n:check — ${errors.length} hiba:`);
    for (const e of errors) console.error(`  ✘ ${e}`);
    process.exit(1);
  }
  console.log(`i18n:check ✔ ${Object.keys(hu).length} kulcs, HU/EN egyezik, minden használt kulcs létezik`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
