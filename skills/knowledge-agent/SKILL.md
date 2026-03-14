---
name: knowledge-agent
description: Use this skill when an agent needs to read, write, or synchronize the repository's local knowledge base and long-term memory store. Apply it for subject profiles, agent memory notes, research capture, or repository-doc synchronization.
---

# Knowledge Agent

## Overview

This skill gives agents a repeatable local path into the knowledge system without scraping the web UI or editing SQLite manually.

## Workflow

1. Read `AGENTS.md`, `docs/security-and-privacy.md`, and `docs/agent-guidelines.md`.
2. Inspect the current workspace with `npm run knowledge:cli -- workspace get`.
3. Create subjects with `npm run knowledge:cli -- subject create --json-file <file>`.
4. Create entries with `npm run knowledge:cli -- entry create --json-file <file>`.
5. Synchronize repository docs with `npm run knowledge:cli -- repo-docs sync` when docs should be mirrored into knowledge.
6. Prefer structured JSON content plus optional markdown narrative so agents and humans can both consume the same entry.

## Key Rules

- Do not read or write the SQLite file directly.
- Keep sensitive human-memory notes local and concise.
- Preserve namespaces, visibility, and provenance fields so later retrieval stays reliable.
- Prefer updating the knowledge store over leaving durable findings only in chat.
