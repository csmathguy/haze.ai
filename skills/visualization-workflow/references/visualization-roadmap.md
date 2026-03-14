# Visualization Roadmap

Reviewed on March 14, 2026.

Audience: agents and maintainers designing a reusable visualization system across planning, audit, code review, knowledge, and taxes.

## Phase 1: Static-First Visual Artifacts

Goal: make diagrams cheap to generate, review, diff, and reuse.

- Standardize on text-first source artifacts such as `.mmd`, `.dot`, and `.d2`.
- Prefer Mermaid as the default checked-in artifact format for docs and PR review because GitHub renders it directly.
- Use Graphviz for generated dependency and impact graphs that come from code or workflow data.
- Keep D2 available as a fallback for architecture diagrams that need stronger layout control or export flexibility.
- Store the durable source file in the repo or ignored artifact folder and treat any SVG or PNG output as derived.

## Phase 2: Shared Visualization Contracts

Goal: stop baking visualization logic into one app at a time.

- Introduce typed visualization payloads in `packages/shared` only when there is a second real use case.
- Model visuals as renderer-agnostic data first:
  - nodes
  - edges
  - metrics
  - grouping or swimlane metadata
  - labels and provenance
- Keep data collection in `apps/*/api` and keep rendering decisions in `apps/*/web` or local tooling adapters.
- Treat Mermaid, Graphviz, D2, and future web renderers as adapters over the same typed payload when the duplication becomes real.

## Phase 3: Interactive Product Views

Goal: add drill-down and exploration only where static artifacts stop being enough.

- Use MUI X Charts for metric dashboards, throughput views, and monitoring summaries inside existing web apps.
- Use React Flow when users need interactive node-based inspection, manual layout, or workflow editing.
- Use Cytoscape.js when the use case is graph analysis, large network filtering, or headless graph processing.
- Keep the initial dynamic scope narrow:
  - workflow monitoring for audit and planning
  - PR change exploration in code review
  - future tax workflow lineage or dependency views only after the upstream data contracts are stable

## First Candidate Use Cases

1. PR change visuals in the code-review product.
   - structural impact map by app boundary
   - commit or branch storyline with Mermaid `gitGraph`
   - optional code-level diff rendering with `diff2html`
2. Workflow monitoring in audit and planning.
   - static flow snapshots for docs and review
   - metric charts for counts, duration, aging, and throughput
   - later interactive graph inspection for stuck or blocked work
3. Cross-app architecture views.
   - shared service boundaries
   - event lineage between planning, audit, knowledge, and code review
   - dependency visuals generated from repo metadata

## Exit Criteria For Future Implementation Work

- Static diagrams must be reproducible from local source artifacts.
- Dynamic views must have exact-value fallbacks and accessible labels.
- Visualization adapters must stay local-only and must not send repository data to hosted services.
- Any shared contracts must live only after at least two product surfaces need the same payload shape.
