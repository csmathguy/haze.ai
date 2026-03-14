---
name: local-development-environment
description: Use this skill when you need to start one or more repository web and API products locally for manual testing, UI review, or cross-app validation. Apply it before opening ad hoc terminal tabs or inventing one-off launch commands.
---

# Local Development Environment

## Overview

This skill standardizes how agents start the repository's local product environments. The current slice targets the main checkout only, even when the command is launched from a worktree.

## Workflow

1. Read `docs/local-development-environments.md`.
2. List the supported environments with `npm run dev:env:list`.
3. Start the needed environment with `npm run dev:env -- --environment <name>`.
4. Use repeated `--environment` flags when more than one product must run together.
5. Use `--dry-run` first when you need to confirm which services and URLs will launch.
6. Stop the full session with `Ctrl+C` instead of killing one child process.

## Key Rules

- Prefer the named environment launcher over hand-running separate `dev:*` scripts.
- Assume the command targets the main checkout in this slice unless the repository later adds a checkout-selection flag.
- Treat the printed URLs and health endpoints as the source of truth for manual testing.
- If the launcher says the main checkout is missing dependencies, run `npm install` there instead of bypassing the guardrail.
