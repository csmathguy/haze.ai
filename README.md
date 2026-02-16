# Haze AI Workspace

Monorepo scaffold for a VPS-hosted agent monitor and task system.

## Structure
- `apps/backend`: Node.js + TypeScript API with heartbeat/orchestrator skeleton.
- `apps/frontend`: React + TypeScript + Material UI monitor dashboard.
- `documentation/tasks`: discovery questions and phased backlog.
- `documentation/standards`: engineering workflow and quality gates.
- `AGENTS.md`: mandatory workflow for humans and coding agents.

## Quick start
1. Install dependencies:
```bash
npm install
```
2. Start backend:
```bash
npm run dev:backend
```
3. Start frontend:
```bash
npm run dev:frontend
```

Frontend proxies `/api` to backend (`http://localhost:3001`).

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm run check:circular`
- `npm run test:coverage`
- `npm run build`
- `npm run verify`

Coverage thresholds are enforced at `>= 60%` for lines/functions/branches/statements in each app.

## Audit logs
- Backend writes append-only audit events as newline-delimited JSON records.
- Default path: `data/audit/YYYY-MM-DD/events.json`.
- Configure with `AUDIT_LOG_DIR`.
- Default retention: `7` days (configure with `AUDIT_RETENTION_DAYS`).
- Records include correlation fields (`traceId`, `requestId`, `userId`) and tamper-evidence fields (`previousHash`, `hash`).

## Heartbeat configuration
- Default heartbeat interval is `30000` ms (30 seconds).
- Default stall threshold is `90000` ms.
- Override with:
  - `HEARTBEAT_INTERVAL_MS`
  - `HEARTBEAT_STALL_THRESHOLD_MS`

## Task storage
- Tasks are persisted to local JSON at `data/tasks/tasks.json` by default.
- Configure task file path with `TASKS_FILE_PATH`.
- On backend startup, task folders in `documentation/tasks` are synced into task records.
- Trigger a resync manually with `POST /agent/actions/sync-tasks-from-codebase`.

## Current backend endpoints
- `GET /health`
- `GET /orchestrator/status`
- `POST /orchestrator/wake`
- `POST /heartbeat/pulse`
- `GET /audit/recent?limit=50`
- `GET /audit/stream` (Server-Sent Events for live audit feed)
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `POST /tasks/actions/next`
- `POST /agent/actions/add-task`
- `POST /agent/actions/sync-tasks-from-codebase`
