import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    environmentMatchGlobs: [
      ["src/tests/components/**", "jsdom"],
    ],
    setupFiles: ["./src/tests/setup.ts"],
  },
});
