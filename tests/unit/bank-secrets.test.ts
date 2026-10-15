// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// B-41 / H3: az Enable privát kulcs és az App ID kizárólag Edge secret — a Next.js alkalmazásban és a kliens-csomagban nincs titok.
// Két védvonal: (1) a forrás nem hivatkozik rájuk, (2) a legutóbbi build kliens-csomagja nem tartalmaz titok-mintát.
const FORBIDDEN = /ENABLE_PRIVATE_KEY|ENABLE_APP_ID|BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY|sb_secret_[A-Za-z0-9]/;

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, accept, out);
    } else if (accept(full)) out.push(full);
  }
  return out;
}

export function findSecrets(files: string[]): string[] {
  return files.filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
}

describe("nincs titok az alkalmazás-forrásban és a kliens-csomagban (H3)", () => {
  const root = process.cwd();

  it("a titok-minta felismer (az őr nem hatástalan)", () => {
    // a PEM-fejlécet futásidőben állítjuk össze: a repo titok-szkennere (H3) a kész fejlécet tartalmazó fájlt is elutasítaná
    const dashes = "-".repeat(5);
    const pem = (kind: string) => `${dashes}BEGIN ${kind}PRIVATE KEY${dashes}`;
    for (const sample of ["x ENABLE_PRIVATE_KEY y", "ENABLE_APP_ID", pem(""), pem("RSA "), "sb_secret_abc123"]) {
      expect(FORBIDDEN.test(sample), sample).toBe(true);
    }
    expect(FORBIDDEN.test("ENABLE_BANKING_URL")).toBe(false);
  });

  it("a forrásban (app, components, lib, utils, proxy.ts) nincs hivatkozás Enable-titokra", () => {
    const sources = ["app", "components", "lib", "utils"].flatMap((d) => walk(join(root, d), (f) => /\.(ts|tsx|mjs|js|json)$/.test(f)));
    sources.push(join(root, "proxy.ts"));
    expect(findSecrets(sources).map((f) => f.slice(root.length + 1))).toEqual([]);
  });

  const staticDir = join(root, ".next", "static");
  (existsSync(staticDir) ? it : it.skip)("a legutóbbi build kliens-csomagja (.next/static) nem tartalmaz titok-mintát", () => {
    expect(findSecrets(walk(staticDir, (f) => /\.(js|css|map|json)$/.test(f))).map((f) => f.slice(root.length + 1))).toEqual([]);
  });
});
