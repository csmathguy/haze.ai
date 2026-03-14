---
name: visualization-workflow
description: Use this skill when researching, choosing, or producing diagrams and visuals for this repository, including architecture diagrams, PR change visuals, workflow monitoring views, roadmap or timeline diagrams, and cross-app dashboards. Apply it when an agent needs to turn repository structure, git diffs, workflow data, or typed metrics into local-first Mermaid, D2, Graphviz, MUI X Charts, React Flow, or Cytoscape outputs.
---

# Visualization Workflow

## Overview

Use this skill to choose the lightest visualization that answers the question and preserves local-only privacy. Prefer text-first, versionable artifacts for docs, PRs, and audit trails. Escalate to interactive runtime views only when users need drill-down, filtering, or direct manipulation.

## Workflow

1. Define the visualization target in one sentence.
2. Capture the constraints that change the answer:
   - audience
   - delivery surface
   - exact review date
   - sensitivity of the underlying data
   - static artifact versus interactive surface
3. Choose the rendering tier:
   - For GitHub-rendered docs, PR notes, or review artifacts, start with Mermaid.
   - For generated graphs with many nodes or deterministic layout needs, consider Graphviz first, then D2.
   - For existing React product dashboards, use MUI X Charts and keep an exact-value fallback in the UI.
   - For interactive node editors or inspectable workflow maps, use React Flow.
   - For large graph analysis or graph-heavy filtering, use Cytoscape.js.
4. Create a durable source file before a rendered asset. Prefer `.mmd`, `.dot`, `.d2`, or typed JSON as the source of truth.
5. Keep visuals local-first. Do not send diffs, workflow data, or tax-domain content to hosted rendering services.
6. Pair every visual with a text fallback:
   - exact counts or labels
   - scope and review date
   - a brief explanation of what changed or why it matters
7. If the task is product planning rather than one-off output, read [references/visualization-roadmap.md](references/visualization-roadmap.md).

## Common Patterns

### PR Change Visuals

- Build a local manifest from `git diff` metadata before rendering.
- Render one structural view and one numeric summary.
- Prefer Mermaid `gitGraph` or a Mermaid or Graphviz impact map for review artifacts.
- Use a diff renderer such as `diff2html` only when reviewers need code-level HTML diffs rather than a structural change summary.

### Workflow And Monitoring Visuals

- Start with Mermaid flowcharts, timelines, or static workflow snapshots for docs and review artifacts.
- Use MUI X Charts for counts, durations, throughput, or backlog aging inside existing web apps.
- Escalate to React Flow or Cytoscape only when users need live filtering, drill-down, or graph manipulation.

### Architecture And Dependency Visuals

- Use Mermaid for small-to-medium service, workflow, or repository-boundary diagrams that should render in Markdown.
- Use Graphviz for generated dependency graphs or larger machine-produced graphs.
- Use D2 when the diagram needs cleaner container-style layouts or export flexibility that Mermaid cannot express cleanly.

## References

- Tool selection and tradeoffs: [references/diagram-selection.md](references/diagram-selection.md)
- Phased reusable-system plan: [references/visualization-roadmap.md](references/visualization-roadmap.md)
