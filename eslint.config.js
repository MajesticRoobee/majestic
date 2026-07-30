// Static analysis that `vite build` cannot do. Tuned to catch the class of bug
// that once shipped a blank storefront: a `useCallback` dep referencing a
// `const` declared later in the component (temporal dead zone → ReferenceError).
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**", ".wrangler/**"] },

  // Frontend (React, browser)
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The guard that would have caught the blank-page crash:
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
      // Not needed with the modern JSX transform / no prop-types in this project
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // Apostrophes/quotes in JSX text render correctly; the brand voice is full
      // of them ("we'll", "isn't") and escaping every one hurts readability.
      "react/no-unescaped-entities": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    },
  },

  // Worker (Cloudflare runtime)
  {
    files: ["worker/**/*.js", "scripts/**/*.mjs"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    },
  },
];
