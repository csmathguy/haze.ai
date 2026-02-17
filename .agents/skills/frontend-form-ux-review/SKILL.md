---
name: frontend-form-ux-review
description: Research and implement high-signal form/detail UX improvements with TDD, accessibility checks, and in-repo reference capture.
---

# Frontend Form UX Review

## Use when
- A task asks for redesign or cleanup of forms/detail drawers/panels.
- You need to combine codebase review with external UX research.
- You want reusable reference material captured in-repo.

## Procedure
1. Identify target UI files + tests with `rg`.
2. Confirm task acceptance criteria in `apps/backend/data/tasks/tasks.json` (or API-backed task metadata).
3. Write failing tests first for:
   - hierarchy/readability outcomes,
   - action placement/progressive disclosure,
   - critical metadata visibility,
   - accessibility labels/roles.
4. Research 3-5 primary UX/accessibility sources (official docs/standards).
5. Implement minimal UI changes to satisfy tests.
6. Add/update a research note in `documentation/research/` with:
   - date,
   - links,
   - extracted rules,
   - mapping to concrete code changes.
7. Re-run targeted tests, then full verification gates.

## Guardrails
- Keep action controls grouped and explicit (avoid mixing high-frequency edits with passive read-only data).
- Use centralized theme tokens; avoid ad-hoc color systems.
- Respect keyboard access and hover/focus accessibility behavior.
- Prefer concise metadata summaries with optional detail via tooltips/popovers.

## Expected output
- Updated UI + tests.
- Research artifact under `documentation/research/`.
- Clear summary of sources, implemented changes, and verification results.
