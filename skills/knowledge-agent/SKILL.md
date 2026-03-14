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
3. Find existing entries before writing new ones with `npm run knowledge:cli -- entry find --search "<topic>" --kind <kind>`.
4. Create subjects with `npm run knowledge:cli -- subject create --json-file <file>`.
5. Create entries with `npm run knowledge:cli -- entry create --json-file <file>` when the note is genuinely new.
6. For durable research, prefer `npm run knowledge:cli -- research-report upsert --json-file <file>` so repeated research updates one report lineage instead of scattering duplicates.
7. Synchronize repository docs with `npm run knowledge:cli -- repo-docs sync` when docs should be mirrored into knowledge.
8. If knowledge capture reveals future work, product ideas, or follow-up implementation slices, create or refine the corresponding planning work items instead of leaving the idea only in the knowledge store.
9. Prefer structured JSON content plus optional markdown narrative so agents and humans can both consume the same entry.

## Key Rules

- Do not read or write the SQLite file directly.
- Keep sensitive human-memory notes local and concise.
- Preserve namespaces, visibility, and provenance fields so later retrieval stays reliable.
- Prefer updating existing research reports over creating duplicates when the topic and namespace already match.
- Prefer updating the knowledge store over leaving durable findings only in chat or docs.
- The knowledge base is for durable memory, not a substitute for planning. Actionable future work still belongs in planning as work items.
