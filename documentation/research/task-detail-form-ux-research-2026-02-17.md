# Task Detail Form UX Research (2026-02-17)

## Scope
Improve the Kanban task detail drawer for scanability, progressive disclosure, and accessible status update flows.

## Sources
- U.S. Web Design System - "Forms": https://designsystem.digital.gov/components/form/
- web.dev - "Sign-in form best practices": https://web.dev/articles/sign-in-form-best-practices
- WCAG 2.2 Understanding SC 1.4.13 (Content on Hover or Focus): https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- MUI Accordion component docs: https://mui.com/material-ui/react-accordion/
- MUI Tooltip component docs: https://mui.com/material-ui/react-tooltip/

## Key guidance extracted
1. Keep forms short and focused; only show controls required for the current decision.
2. Use progressive disclosure to hide advanced/less-frequent controls until requested.
3. Keep labels explicit and close to inputs so operators can act quickly.
4. Preserve keyboard and hover/focus accessibility for contextual/read-only details.
5. Put high-signal read-only metadata into compact, scannable summaries rather than long paragraphs.

## Applied changes in this repository
- Moved human status updates into a dedicated top-of-panel `Actions` accordion.
- Promoted critical read-only task metadata (ID, status, branch) into compact icon pills.
- Added explicit `Acceptance Criteria` section sourced from `metadata.acceptanceCriteria`.
- Added `Timeline` section with Created/Updated/Started/Due/Completed pills and tooltips.
- Preserved visible labels and existing keyboard-accessible controls.

## Reuse checklist for future task/form UIs
- Add or update acceptance criteria first in the task record.
- Write/adjust UI tests for hierarchy + interactions before implementation.
- Keep primary actions visible and grouped under one "Actions" entry point.
- Convert low-priority read-only fields to concise pills with tooltip details.
- Validate hover/focus behavior and keyboard navigation in tests.
