import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Map app workspace packages to their source in this worktree so gateway
      // tests resolve correctly despite the shared node_modules junction pointing
      // at the main checkout (which may not yet have the exports field).
      "@taxes/api": path.resolve("apps/taxes/api/src/app.ts"),
      "@taxes/audit-api": path.resolve("apps/audit/api/src/app.ts"),
      "@taxes/code-review-api": path.resolve("apps/code-review/api/src/app.ts"),
      "@taxes/db": path.resolve("packages/db/src/index.ts"),
      "@taxes/knowledge-api": path.resolve("apps/knowledge/api/src/app.ts"),
      "@taxes/plan-api": path.resolve("apps/plan/api/src/app.ts"),
      "@taxes/shared": path.resolve("packages/shared/src/index.ts")
    }
  },
  test: {
    coverage: {
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80
      },
      include: [
        "apps/taxes/api/src/app.ts",
        "apps/taxes/api/src/services/**/*.ts",
        "apps/taxes/web/src/app/api.ts",
        "apps/taxes/web/src/app/index.ts",
        "packages/shared/src/assets.ts",
        "packages/shared/src/common.ts",
        "packages/shared/src/documents.ts",
        "packages/shared/src/extraction.ts",
        "packages/shared/src/questionnaire.ts",
        "packages/shared/src/tax-return.ts",
        "packages/shared/src/workspace.ts"
      ],
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      exclude: ["**/*.d.ts", "**/*.test.*", "**/*.spec.*", ".worktrees/**", ".claude/**", "artifacts/**", "node_modules/**"]
    },
    environment: "node",
    exclude: [".worktrees/**", ".claude/**", "artifacts/**", "coverage/**", "dist/**", "node_modules/**"],
    globals: true,
    pool: "forks",
    include: ["**/*.{test,spec}.ts"],
    passWithNoTests: false,
    testTimeout: 30000
  }
});
