import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "docs/**", "next-env.d.ts"],
  },
  {
    // A heterogeneous AI tool registry is necessarily existential over each
    // tool's own (params, result) shape — every tool is still strongly typed
    // against its own zod schema at definition time; only the collection
    // type itself is `any`. See lib/ai-tools/registry.ts.
    files: ["lib/ai-tools/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
