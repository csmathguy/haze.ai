import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "coverage/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-console": "off",
      "max-lines": [
        "error",
        {
          max: 400,
          skipBlankLines: true,
          skipComments: true
        }
      ]
    }
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "max-lines": "off"
    }
  },
  {
    files: ["apps/backend/src/tasks.ts"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 2200,
          skipBlankLines: true,
          skipComments: true
        }
      ]
    }
  },
  {
    files: ["apps/frontend/src/components/KanbanView.tsx"],
    rules: {
      "max-lines": [
        "error",
        {
          max: 1800,
          skipBlankLines: true,
          skipComments: true
        }
      ]
    }
  },
  {
    files: ["apps/frontend/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true }
      ]
    }
  }
);
