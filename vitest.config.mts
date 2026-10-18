import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Cold DOCX parser imports can exceed five seconds on Windows and network drives.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/prompts/**/*.ts"],
      thresholds: {
        statements: 77,
        branches: 61,
        functions: 85,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(configDirectory, "./src") },
  },
});
