# Architecture Enforcement

## Important Clarification

ArchUnit is a strong architecture-testing tool for JVM projects. This repository uses the TypeScript-native `archunit` package, which brings the same style of dependency and architecture assertions to a Node.js and React codebase.

## Recommended Enforcement Stack

- ArchUnitTS for architectural dependency and file-budget tests
- ESLint import restrictions for local guardrails during editing
- TypeScript path aliases and package-local tsconfig files to make boundaries explicit

## Rules To Enforce Early

- `apps/*/web` can depend on `packages/shared` but not on `apps/*/api`
- `apps/*/api` can depend on `packages/shared` but not on `apps/*/web`
- `packages/shared` cannot depend on app packages or framework-specific UI code
- adapter layers cannot be imported directly by unrelated features
- test helpers stay out of production entrypoints

## Current ArchUnitTS Rules

- forbid imports from `apps/**/api/src/**` into `apps/**/web/src/**`
- forbid imports from `apps/**/web/src/**` into `apps/**/api/src/**`
- forbid imports from `apps/**` into `packages/shared/src/**`
- require `apps/*/api` and `apps/*/web` to import shared code through `@taxes/shared` instead of deep internal paths
- prevent production source files from importing `*.test.ts` and `*.spec.ts`
- forbid circular dependencies inside the app and shared source trees
- forbid circular dependencies inside repo tooling
- fail when application, shared, or tooling files exceed the 400-line file budget

## Suggested ESLint Rules

- `no-restricted-imports` for banned cross-layer imports
- ban deep imports into `@taxes/shared/*` so apps consume the public package surface
- keep `packages/shared` free of `react`, `@mui/*`, and `node:*` imports
- keep `apps/*/web` free of `node:*` imports
- typed `typescript-eslint` rules for async safety and exhaustive branching
- structural limits such as `max-lines`, `max-lines-per-function`, `max-depth`, `max-params`, and `complexity`
- security-focused checks from `eslint-plugin-security`
- separate overrides for tests so test-only helpers do not leak into production code

## When To Revisit

- After the initial workspace scaffold
- When introducing background jobs or a plugin-based extraction system
- When a second report/export pipeline appears and shared abstractions become necessary
- When we want to add finer-grained bounded-context or feature-slice rules inside `apps/*/api` and `apps/*/web`
