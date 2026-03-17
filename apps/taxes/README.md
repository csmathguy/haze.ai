# Taxes App First-Run Guide

This runbook is for a first-time local startup from the repository root.

## Start The Taxes Environment

Run this command from the repository root:

```bash
npm run dev:env -- --environment taxes
```

This starts both services:

- Taxes API: `http://127.0.0.1:3040`
- Taxes Web: `http://127.0.0.1:5173`

## Verify Health

1. Open the API health endpoint:

```bash
curl http://127.0.0.1:3040/api/health
```

Expected response:

```json
{"status":"ok","localOnly":true}
```

2. Open the web app:

```text
http://127.0.0.1:5173
```

3. Confirm workspace data loads:

```bash
curl http://127.0.0.1:3040/api/workspace
```

## Runtime Configuration

You can override runtime values with environment variables before startup:

- `TAXES_API_HOST` (default `127.0.0.1`)
- `TAXES_API_PORT` (default `3040`)
- `TAXES_WEB_PORT` (default `5173`)
- `TAXES_API_ORIGIN` (web proxy target, default `http://<TAXES_API_HOST>:<TAXES_API_PORT>`)
- `TAXES_WEB_ORIGINS` (comma-separated CORS origins for API, default includes localhost/127.0.0.1 at `TAXES_WEB_PORT`)
- `DATABASE_URL` or `TAXES_DATABASE_URL` (default `file:./data/sqlite/taxes.db`)
- `TAXES_WORKSPACE_DATA_ROOT` (default `./data/workspace`)

Example:

```bash
set TAXES_API_PORT=4040
set TAXES_WEB_PORT=5174
npm run dev:env -- --environment taxes
```

## Inspect SQLite And Workspace Paths

With default settings:

- SQLite file: `data/sqlite/taxes.db`
- Workspace root: `data/workspace`
- Upload storage: `data/workspace/uploads`

Quick checks:

```bash
dir data\\sqlite
dir data\\workspace
```

## Troubleshooting

### Port Already In Use

- Symptom: startup fails with `EADDRINUSE`.
- Fix: set `TAXES_API_PORT` and/or `TAXES_WEB_PORT` to free ports, then restart.

### Missing Workspace Or SQLite Directories

- Symptom: startup errors about missing files or directories.
- Fixes:
  1. Run `npm run prisma:migrate:deploy`.
  2. Restart with `npm run dev:env -- --environment taxes`.
  3. If needed, create parent folders manually:
     - `data/sqlite`
     - `data/workspace`

### CORS Errors In Browser

- Symptom: browser requests to `/api` fail with CORS errors.
- Fix: ensure `TAXES_WEB_ORIGINS` includes the active web origin (for example `http://127.0.0.1:5173`).

