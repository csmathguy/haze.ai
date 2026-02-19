# Enterprise TypeScript Architecture Guardrails (2026-02-18)

## Purpose
Define enforceable architecture and design standards for this repository so changes remain modular, testable, and maintainable as orchestration complexity grows.

## Required principles
- `S`: single responsibility per module/class.
- `O`: extension through interfaces and composition, not deep branching.
- `L`: contract-safe substitutions (providers/adapters must preserve interface behavior).
- `I`: small interfaces per capability (do not force consumers to depend on unused methods).
- `D`: high-level workflow code depends on abstractions, not concrete API/CLI implementations.

## Approved architectural style
- Layered ports-and-adapters for backend:
  - `domain`: pure business rules and value types.
  - `services/application`: workflow orchestration and use-case logic.
  - `infrastructure`: provider adapters, persistence, external APIs, process execution.
  - `api`: HTTP/MCP transport boundary.

Dependency direction must flow inward toward domain logic.

## Pattern standards for this repo
- Strategy pattern:
  - Use for runtime-selectable providers (for example CLI/API invocation providers).
- Adapter pattern:
  - Use for external systems (OpenAI, CLI processes, file stores, audit sinks).
- Factory/composition root:
  - Use in startup wiring (`index.ts`) to construct concrete implementations.
- Policy object pattern:
  - Centralize allowlist/blocklist and safety checks in one policy evaluator.

When using one of these, add a short inline comment near the abstraction declaration naming the pattern and why it is used.

## TypeScript quality guardrails
- Keep `strict`-mode compatible types and avoid `any` unless explicitly justified.
- Define explicit request/result interfaces for service boundaries.
- Favor discriminated unions for variant outcomes and error classes.
- Prefer immutable inputs and explicit return values over hidden mutation.

## Modularity and file-size guardrails
- Soft cap: ~300 logical lines per file.
- Hard review trigger: >500 lines or more than one dominant responsibility.
- If a file exceeds the soft cap:
  - split interface/type definitions from implementation;
  - split policy, orchestration, and adapter logic into separate modules;
  - keep tests aligned one-to-one with split responsibilities.

## Folder management guardrails
- Backend growth pattern:
  - `apps/backend/src/domain/*`
  - `apps/backend/src/services/*`
  - `apps/backend/src/infrastructure/*`
  - `apps/backend/src/api/*`
- Test placement mirrors source boundaries (`apps/backend/test/*` with focused suites).
- Avoid dumping unrelated functionality into top-level `src/*.ts` files once a feature has more than one module.

## Review checklist (required before `finish-task`)
1. Does each changed file have one clear responsibility?
2. Are external dependencies isolated behind interfaces/adapters?
3. Are policies and validation centralized instead of scattered?
4. Can provider/runtime implementations be swapped without workflow rewrites?
5. Are tests aligned to domain/service boundaries (unit) and boundary seams (integration)?
6. Is any file too large or doing more than one layer's job?

Related execution playbook:
- `documentation/standards/modularity-refactor-playbook-2026-02-18.md`

## References
- TypeScript `strict` mode and compiler options:
  - https://www.typescriptlang.org/tsconfig/#strict
- TypeScript project structuring via references:
  - https://www.typescriptlang.org/docs/handbook/project-references.html
- Fowler on dependency inversion / injection tradeoffs:
  - https://martinfowler.com/articles/injection.html
- Azure architecture guidance on CQRS and separation of read/write concerns:
  - https://learn.microsoft.com/azure/architecture/patterns/cqrs
- ESLint maintainability controls (`max-lines`, `max-lines-per-function`):
  - https://eslint.org/docs/latest/rules/max-lines
  - https://eslint.org/docs/latest/rules/max-lines-per-function
