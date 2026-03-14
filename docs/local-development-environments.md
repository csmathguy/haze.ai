# Local Development Environments

Audience: agents and humans starting repository web and API products locally.
Scope: repo-level environment orchestration from the main checkout.
Reviewed: March 13, 2026.

## Decision

Use a repo-local Node supervisor plus npm workspace targeting as the default pattern for starting product environments in this repository.

This is an inference from the source set and the current codebase. Official npm workspace support already lets one command target a specific workspace script, and Node already exposes the child-process and signal primitives needed to supervise multiple long-running services. In this repo, that combination fits better than container-first orchestration because the applications already run directly from local source trees, the APIs and Vite apps have deterministic localhost ports, and a later worktree-aware launcher can be added by changing checkout-root resolution instead of replacing the orchestration model.

## Current Command Surface

- `npm run dev:env:list`
  - lists the supported named environments and their URLs
- `npm run dev:env -- --environment taxes`
  - starts the Taxes API and Taxes Web from the main checkout
- `npm run dev:env -- --environment audit --environment plan`
  - starts more than one product environment at once
- `npm run dev:env -- --environment all --dry-run`
  - prints the launch plan without starting processes

## Repo refresh helper

`npm run repo:refresh` chains `git fetch origin main`, `git pull origin main`, and `npm install` (using the pinned `tools/runtime/run-npm.cjs` helper) before restarting the named environment(s). By default it launches `--environment all`, but you can pass `--environment`/`--env` multiple times or comma-separated to run a subset, override the branch/remote with `--branch`/`--remote`, or stop before the services start with `--skip-dev`.

After the refresh finishes, the same `npm run dev:env` flow brings every API and web app back online and logs into `.tmp` artifacts; stop the session with `Ctrl+C` just as you would during a manual launch. Run `npm run repo:refresh -- --help` to see the full option set.

The launcher starts from the repository's main checkout even when you invoke it from a worktree. That gives the team one stable target today while preserving a clean seam for future worktree selection.

## Named Environments

- `taxes`
  - API: `http://127.0.0.1:3040`
  - Web: `http://127.0.0.1:5173`
- `plan`
  - API: `http://127.0.0.1:3140`
  - Web: `http://127.0.0.1:5175`
- `audit`
  - API: `http://127.0.0.1:3180`
  - Web: `http://127.0.0.1:5174`
- `knowledge`
  - API: `http://127.0.0.1:3240`
  - Web: `http://127.0.0.1:5177`
- `code-review`
  - API: `http://127.0.0.1:3142`
  - Web: `http://127.0.0.1:5178`
- `all`
  - starts every environment above

## Why This Pattern Fits

1. npm workspaces already support running a script in one named workspace or across multiple workspaces, so the launcher does not need a second package manager or a parallel script catalog.
2. Node `child_process.spawn()` already supports long-running subprocesses, detached process groups, and explicit abort or signal handling, which is enough for a repo-local supervisor.
3. The repo already encodes stable ports and Vite-to-API proxy targets inside each product app, so a manifest-driven launcher can stay small and deterministic.
4. The repo is local-only and source-tree oriented. Running directly from the checkout avoids adding a Docker dependency for workflows that do not need container isolation.

## Rejected Alternatives

### Docker Compose Profiles

Docker Compose profiles are useful when services should be selectively enabled from a Compose model. That is a sourced fact from Docker's profile documentation. I am not using it here because this repo's active services are already Node and Vite processes running from local source, and the next requested feature is worktree selection, not container image management. Using Compose now would add another runtime dependency without solving the checkout-root problem directly.

### PM2 Ecosystem Files

PM2 supports declaring multiple applications with per-app `cwd`, `script`, and watch settings. That is a sourced fact from the PM2 ecosystem-file documentation. I am not using it here because the repository already has audit-aware tooling, npm workspace conventions, and TypeScript-based repo automation. A small in-repo launcher keeps the behavior inspectable in code, avoids an extra runtime dependency, and can evolve with repo-specific needs such as main-versus-worktree targeting.

## Operational Notes

- The launcher writes service logs into ignored audit artifact paths.
- The launcher records a structured audit run for each environment session.
- If the main checkout does not have dependencies installed, the launcher fails fast and tells you to run `npm install` there.
- Prisma-backed API watch scripts exclude generated Prisma client directories under `node_modules` so `npm install` or `npm run prisma:generate` does not tear down running local APIs during client regeneration.
- Use `Ctrl+C` to stop the whole environment session.

## Future Seam

Worktree targeting should be implemented as a checkout-selection layer on top of the same service manifest:

1. keep the named environment catalog unchanged
2. add an explicit checkout selector such as `main` or `current-worktree`
3. resolve the selected checkout root before spawning workspace commands

That keeps the current command model stable while allowing future testing against a feature worktree instead of `main`.

## Sources

- npm CLI workspaces: https://docs.npmjs.com/cli/v11/using-npm/workspaces
- Node child processes: https://nodejs.org/api/child_process.html
- Node process signals: https://nodejs.org/api/process.html
- Docker Compose profiles: https://docs.docker.com/compose/how-tos/profiles/
- PM2 application declaration: https://pm2.keymetrics.io/docs/usage/application-declaration/
