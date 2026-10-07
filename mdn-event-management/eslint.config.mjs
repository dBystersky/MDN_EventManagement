import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turn off stylistic rules that Prettier owns. Must stay last.
  prettier,
  {
    rules: {
      // Mount-time fetches (`refresh()` on each CRUD page) trip this rule.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma client output and vendored agent skills
    "generated/**",
    ".agents/**",
    ".claude/**",
    ".windsurf/**",
    ".cursor/**",
  ]),
]);

export default eslintConfig;
