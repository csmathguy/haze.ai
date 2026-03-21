# Gateway Architecture

The gateway (`apps/gateway/api`) is a **unified API aggregation layer** — a single Fastify server on port 3000 that all the web apps talk to. It is **not a proxy** that forwards HTTP calls to other services. Instead it **embeds** all the domain APIs as Fastify plugins, connecting each one to its own SQLite database. One process, one port, all the domains.

---

## Startup Sequence

```
1. Apply pending migrations to all 5 databases (in parallel)
2. Build the Fastify app (register all plugins)
3. Listen on 127.0.0.1:3000
4. Log startup message to stdout
5. On error: close app and exit with code 1
```

The migration runner is custom (not Prisma Migrate). It reads from `prisma/migrations/`, tracks applied migrations in a `_taxes_migrations` table, and handles idempotency gracefully — if a migration was partially applied to a pre-existing schema it checks whether the objects already exist and marks it complete rather than failing.

Key file: `apps/gateway/api/src/index.ts` (36 lines)

---

## Routes

| Route | Source |
|-------|--------|
| `GET /api/health` | Gateway itself |
| `POST /webhooks/github` | Gateway itself |
| `GET /api/workspace` | Taxes plugin |
| `GET /api/audit/runs` | Audit plugin |
| `GET /api/planning/workspace` | Plan plugin |
| `GET /api/knowledge/workspace` | Knowledge plugin |
| `GET /api/code-review/workspace` | Code Review plugin |
| `GET /api/workflow/definitions` | Workflow plugin |
| `GET /api/workflow/runs` | Workflow plugin |
| `GET /api/workflow/runs/:id` | Workflow plugin |
| `POST /api/workflow/runs` | Workflow plugin |
| `POST /api/workflow/runs/:id/signal` | Workflow plugin |
| `DELETE /api/workflow/runs/:id` | Workflow plugin |

CORS is enabled for all local dev ports: 5100 (shell), 5173 (taxes), 5174 (audit), 5175 (plan), 5177 (knowledge), 5178 (code-review), 5179 (workflow).

---

## The Five Databases

Each domain owns its own isolated SQLite database. The gateway migrates all five at startup and passes the URL to each plugin:

| Domain | Environment Variable | Default Path |
|--------|---------------------|--------------|
| Taxes | `DATABASE_URL` | `./data/sqlite/taxes.db` |
| Planning | `PLANNING_DATABASE_URL` | `~/.taxes/planning/sqlite/planning.db` |
| Audit | `AUDIT_DATABASE_URL` | `~/.taxes/audit/sqlite/audit.db` |
| Knowledge | `KNOWLEDGE_DATABASE_URL` | `~/.taxes/knowledge/sqlite/knowledge.db` |
| Workflow | `WORKFLOW_DATABASE_URL` | `~/.taxes/workflow/sqlite/workflow.db` |

All URLs are overridable via environment variables. Tests use this to create fresh isolated databases for each test run via `buildGatewayApp(options)`.

SQLite configuration applied to every database:
- Foreign key constraints enabled
- WAL (Write-Ahead Logging) journal mode
- 5-second busy timeout
- Normal synchronous mode

---

## Plugin Architecture

The gateway does not proxy HTTP — it registers each domain API as an in-process Fastify plugin:

```typescript
await app.register(registerTaxesPlugin,      { databaseUrl: taxesDb });
await app.register(registerAuditPlugin,      { databaseUrl: auditDb });
await app.register(registerPlanPlugin,       { databaseUrl: planningDb });
await app.register(registerKnowledgePlugin,  { databaseUrl: knowledgeDb, docsRoot });
await app.register(registerCodeReviewPlugin, { auditDatabaseUrl, planningDatabaseUrl });
await app.register(registerWorkflowPlugin,   { databaseUrl: workflowDb });
```

Each plugin is imported from an internal `@taxes/*` package and registers its own Fastify routes. The gateway provides database URLs and options, but all logic lives in the domain packages.

Key file: `apps/gateway/api/src/app.ts` (65 lines)

---

## GitHub Webhook Handler

`POST /webhooks/github` is the most important route for the agent workflow loop. This is how GitHub talks to the system.

### Flow

```
GitHub fires webhook
       ↓
Signature verified via HMAC-SHA256 (x-hub-signature-256 header)
       ↓
Event type parsed from x-github-event header
       ↓
Correlation ID computed (smart linkage to planning items)
       ↓
Stored as a WorkflowEvent in the workflow SQLite DB
       ↓
WorkflowWorker picks it up on next poll cycle
       ↓
Routed to appropriate handler (PR merged, CI complete, etc.)
```

### Supported Event Types

| GitHub Event | Stored As | Example |
|-------------|-----------|---------|
| `pull_request` | `github.pull_request.{action}` | `github.pull_request.merged` |
| `push` | `github.push` | `github.push` |
| `workflow_run` | `github.workflow_run.{conclusion}` | `github.workflow_run.success` |
| `check_suite` | `github.check_suite.{conclusion}` | `github.check_suite.failure` |
| `check_run` | `github.check_run.{conclusion}` | `github.check_run.failure` |
| anything else | `github.unknown` | `github.unknown` |

### Correlation ID Logic

The correlation ID links a GitHub event back to a planning work item:

| Scenario | Correlation ID |
|----------|---------------|
| PR event | `csmathguy/haze.ai#42` |
| CI event on `feature/plan-206` branch | `PLAN-206` (regex extracted) |
| CI event on `main` branch | `csmathguy/haze.ai@{commit-sha}` |

This is how `github.pull_request.merged` on a `feature/plan-206` branch automatically marks PLAN-206 done — the WorkflowWorker matches the correlationId to the work item.

### Signature Verification

- Uses `x-hub-signature-256` header (HMAC-SHA256)
- Timing-safe byte comparison (prevents timing attacks)
- Configured via `GITHUB_WEBHOOK_SECRET` environment variable
- If secret is not configured: skips verification and logs a warning (OK for local dev)

### HTTP Responses

| Code | Meaning |
|------|---------|
| `202 Accepted` | Event stored, returns `{ id, type }` |
| `401 Unauthorized` | Invalid or missing signature |
| `400 Bad Request` | Missing `x-github-event` header or invalid payload |
| `500 Internal Server Error` | Database write failure |

Key file: `apps/gateway/api/src/routes/webhooks.ts` (358 lines)

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GATEWAY_HOST` | `127.0.0.1` | Server bind address |
| `GATEWAY_PORT` | `3000` | Server listen port |
| `DATABASE_URL` | `./data/sqlite/taxes.db` | Taxes database |
| `PLANNING_DATABASE_URL` | `~/.taxes/planning/sqlite/planning.db` | Planning database |
| `AUDIT_DATABASE_URL` | `~/.taxes/audit/sqlite/audit.db` | Audit database |
| `KNOWLEDGE_DATABASE_URL` | `~/.taxes/knowledge/sqlite/knowledge.db` | Knowledge database |
| `WORKFLOW_DATABASE_URL` | `~/.taxes/workflow/sqlite/workflow.db` | Workflow database |
| `GITHUB_WEBHOOK_SECRET` | (none) | GitHub webhook HMAC secret |
| `REPOSITORY_DOCS_ROOT` | `../../../../docs` | Documentation root path |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Client Web Apps                                                │
│  Shell(5100) | Taxes(5173) | Audit(5174) | Plan(5175) | ...    │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (CORS enabled)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Gateway API — Fastify, port 3000                               │
│                                                                  │
│  GET  /api/health                                               │
│  POST /webhooks/github  ←── GitHub webhooks                     │
│                                                                  │
│  ┌──────────┬──────────┬──────────┬───────────┬──────────────┐  │
│  │ Taxes    │ Audit    │ Plan     │ Knowledge │ Workflow     │  │
│  │ Plugin   │ Plugin   │ Plugin   │ Plugin    │ Plugin       │  │
│  │/api/*    │/api/     │/api/     │/api/      │/api/workflow │  │
│  │          │audit/*   │planning/*│knowledge/*│/*            │  │
│  └──────────┴──────────┴──────────┴───────────┴──────────────┘  │
└──────┬──────────┬──────────┬──────────┬───────────┬─────────────┘
       ▼          ▼          ▼          ▼           ▼
   Taxes DB   Audit DB  Planning DB  Knowledge DB  Workflow DB
   (SQLite)   (SQLite)   (SQLite)    (SQLite)      (SQLite)
                                                      ↑
                                              WorkflowEvent table
                                              (webhook events land here,
                                               WorkflowWorker polls it)
```

---

## The Practical Limitation: Localhost Only

The gateway binds to `127.0.0.1:3000` by default — localhost only. GitHub cannot reach it unless you expose it externally (e.g., via ngrok or a deployed environment).

**Implications:**
- The PR-merged → work item done automation (PLAN-167) only fires automatically when the gateway is running locally AND GitHub webhooks are tunneled to it
- The CI event ingestion (PLAN-192) has the same constraint
- When not running: you mark work items done manually (or via the CLI)

Getting the gateway reliably accessible is a prerequisite for the full automation loop working end-to-end without manual steps.

---

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `apps/gateway/api/src/index.ts` | 36 | Entry point, startup orchestration |
| `apps/gateway/api/src/app.ts` | 65 | Fastify app builder, plugin registration |
| `apps/gateway/api/src/config.ts` | 52 | Environment config, CORS origins, DB URLs |
| `apps/gateway/api/src/routes/webhooks.ts` | 358 | GitHub webhook ingestion |
| `apps/gateway/api/src/db/migrations.ts` | 218 | Custom migration runner |
| `apps/gateway/api/src/db/client.ts` | 22 | Prisma client wrapper (workflow-scoped) |

---

## Tech Stack

| Aspect | Detail |
|--------|--------|
| Framework | Fastify 5.x |
| Database driver | better-sqlite3 (synchronous) |
| Payload validation | Zod |
| Language | TypeScript (ESM, ES2023) |
| Runtime | Node.js via tsx |
| Tests | Vitest with in-memory SQLite DBs |
