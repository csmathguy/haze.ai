import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80
      },
      include: [
        "apps/api/src/app.ts",
        "apps/api/src/services/**/*.ts",
        "apps/web/src/app/index.ts",
        "packages/shared/src/assets.ts",
        "packages/shared/src/common.ts",
        "packages/shared/src/documents.ts",
        "packages/shared/src/tax-return.ts",
        "packages/shared/src/workspace.ts"
      ],
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      exclude: ["**/*.d.ts", "**/*.test.*", "**/*.spec.*"]
    },
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.ts"],
    passWithNoTests: false,
    testTimeout: 30000
  }
});
