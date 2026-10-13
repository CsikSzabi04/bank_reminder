import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // H8: felhasználói szöveg csak fordítási kulcson át; nyers JSX-szöveg tilos.
  // Írásjelek/szimbólumok (elválasztók) megengedettek; a fejlesztői játszótér és a tesztek kivételek.
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["app/dev/**"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: false, ignoreProps: true, allowedStrings: ["·", "—", "–", "/", "|", "•", "…", ":", "(", ")", "-"] },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // AI-A területe (Deno Edge Function-ök, szkriptek): saját ellenőrzésük van
    "supabase/**",
    "scripts/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
