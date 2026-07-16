import js from "@eslint/js";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "outputs/**",
      "inputs/**",
      "dashboard/geo/**",
      "dashboard/*.parquet",
      "dashboard/data.json",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        Buffer: "readonly",
        clearTimeout: "readonly",
        document: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        WebSocket: "readonly",
        window: "readonly",
      },
    },
  },
];
