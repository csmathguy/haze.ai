import eslint from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";
import frontendStylePlugin from "./tools/eslint/frontend-style-plugin.mjs";

const sourceFiles = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "prisma.config.ts", "tools/**/*.ts", "vitest.config.ts"];

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "apps/**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "eslint.config.mjs",
      "tools/runtime/**/*.cjs",
      "data/**",
      "uploads/**",
      "artifacts/**",
      "generated/**",
      "tmp/**",
      "temp/**"
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    }
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  {
    files: sourceFiles,
    languageOptions: {
      globals: {
        ...globals.node
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      security
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports"
        }
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false
          }
        }
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: "only-allowed-literals"
        }
      ],
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "complexity": [
        "error",
        {
          max: 10,
          variant: "modified"
        }
      ],
      "eqeqeq": ["error", "always"],
      "max-depth": [
        "error",
        {
          max: 3
        }
      ],
      "max-lines": [
        "error",
        {
          max: 750,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      "max-lines-per-function": [
        "error",
        {
          max: 75,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      "max-params": [
        "error",
        {
          max: 4
        }
      ],
      "no-console": [
        "error",
        {
          allow: ["warn", "error"]
        }
      ],
      "no-debugger": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["apps/**/api/**"],
              message: "Import backend code through HTTP contracts, not direct frontend dependencies."
            }
          ]
        }
      ],
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-non-literal-require": "error",
      "security/detect-object-injection": "off",
      "security/detect-possible-timing-attacks": "warn"
    }
  },
  {
    files: ["apps/**/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      "frontend-style": frontendStylePlugin
    },
    rules: {
      "frontend-style/max-sx-props": [
        "error",
        {
          maxProperties: 6
        }
      ],
      "frontend-style/no-hardcoded-color-literals": "error",
      "frontend-style/no-inline-styles": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["apps/**/api/**"],
              message: "Import backend code through HTTP contracts, not direct frontend dependencies."
            },
            {
              group: ["@taxes/shared/*"],
              message: "Import shared code through the public @taxes/shared entrypoint."
            },
            {
              group: ["node:*"],
              message: "Frontend code must stay browser-compatible and avoid Node built-ins."
            },
            {
              group: ["**/theme/tokens", "**/theme/tokens.*"],
              message: "Import frontend theme concerns through the public theme entrypoint instead of internal token files."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/**/web/src/theme/**/*.{ts,tsx}"],
    rules: {
      "frontend-style/no-hardcoded-color-literals": "off"
    }
  },
  {
    files: ["apps/**/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["apps/**/web/**"],
              message: "Backend code must not depend on frontend code."
            },
            {
              group: ["@taxes/shared/*"],
              message: "Import shared code through the public @taxes/shared entrypoint."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["apps/**/api/**", "apps/**/web/**"],
              message: "Shared code must remain free of app-layer dependencies."
            },
            {
              group: ["react", "react-dom", "@mui/**", "node:*"],
              message: "Shared code must stay framework-light and runtime-agnostic."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["tools/agent/**/*.ts"],
    rules: {
      "sonarjs/no-os-command-from-path": "off"
    }
  },
  {
    files: ["**/*.{test,spec}.ts"],
    rules: {
      "max-lines-per-function": "off",
      "no-console": "off"
    }
  }
);
