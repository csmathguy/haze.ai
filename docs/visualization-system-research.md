# Visualization System Research

Reviewed on March 14, 2026.

Audience: repository maintainers and agents defining a reusable visualization system for planning, audit, code review, knowledge, and taxes.

Scope: local-first diagrams, PR change visuals, workflow monitoring, and a future path to interactive graph views.

## Recommendation

Use Mermaid as the default text-to-diagram format for checked-in docs and PR-facing visual artifacts. Pair it with Graphviz for generated dependency or impact graphs, keep D2 as an architecture-focused fallback, use MUI X Charts for in-app metric dashboards, and defer React Flow or Cytoscape.js to later interactive graph work.

## Why This Fits The Repository

### Sourced Facts

- Mermaid renders diagrams from text and code, and GitHub renders Mermaid inside fenced Markdown code blocks. Mermaid also supports architecture diagrams and `gitGraph`, which is directly relevant to PR and branching visuals.
- D2 is a declarative diagramming language with a completely offline local CLI, multiple layout engines, and CLI export to SVG, PNG, and PDF.
- Graphviz supports multiple layout engines and a broad set of output formats, including JSON, PDF, PNG, and SVG.
- MUI X Charts is already aligned with the React stack and offers an MIT-licensed Community package plus a commercial Pro package.
- React Flow is a MIT-licensed React library for node-based editors and interactive diagrams, and it supports server-side rendering when node dimensions and handle positions are provided explicitly.
- Cytoscape.js is an open-source graph theory library for visualization and analysis and can run headlessly on Node.js.
- diff2html provides line-by-line and side-by-side HTML diff rendering.

### Inference

- Mermaid is the best phase-one default because it is text-first, GitHub-friendly, and good enough for the first wave of architecture, workflow, and PR-story visuals.
- Graphviz is the best generated-graph backend because machine-produced dependency and impact views care more about deterministic layout and output formats than hand authoring.
- D2 is valuable, but it should stay optional at first because Mermaid already covers the review and Markdown path more directly.
- React Flow and Cytoscape.js solve a different problem from Mermaid and Graphviz: they are runtime interaction layers, not the first artifact format to standardize on.

## Candidate Comparison

| Tool | Best Role | Strengths | Limits | Recommendation |
| --- | --- | --- | --- | --- |
| Mermaid | Docs, PR artifacts, workflow snapshots, branch visuals | Text-first, GitHub-rendered, broad diagram coverage, `gitGraph`, architecture diagrams | Layout can get cramped on larger generated graphs | Standardize on this first |
| Graphviz | Generated dependency or impact graphs | Mature layout engines, many export formats, good for machine-produced graphs | Less pleasant for casual manual authoring in Markdown-heavy workflows | Use as the generated-graph backend |
| D2 | Architecture and presentation diagrams | Declarative syntax, offline CLI, multiple layout engines, export flexibility | GitHub does not render D2 directly, so it is less frictionless for PR artifacts | Keep as an optional fallback |
| MUI X Charts | In-app dashboards and monitoring panels | Fits current stack, strong chart coverage, SVG-rendered React components | Numeric dashboards only; not a graph-editor layer | Use for product metrics |
| React Flow | Interactive workflow and graph inspection | Node-based interaction, custom React nodes, SSR path exists | Higher implementation cost and runtime complexity | Delay until drill-down is required |
| Cytoscape.js | Large graph analysis and heavy filtering | Graph-analysis features, headless Node.js support | More specialized than most first-wave visualization needs | Reserve for graph-heavy cases |
| diff2html | Code-level diff rendering | Familiar line-by-line and side-by-side views | Not an architecture or workflow diagram system | Use only as a companion for code diff views |

## Proposed Reusable System

### Phase 1: Artifact Standards

1. Treat text-first source files as the durable artifact:
   - `.mmd` for Mermaid
   - `.dot` for Graphviz
   - `.d2` for D2 when needed
2. Keep any SVG or PNG output derived from those source files.
3. Require each visual to carry:
   - exact review date
   - scope
   - labels or exact values
   - a short prose explanation

### Phase 2: Shared Visualization Contracts

1. Do not add shared visualization contracts yet.
2. When a second concrete use case appears, add renderer-agnostic payloads in `packages/shared`:
   - nodes
   - edges
   - metrics
   - grouping metadata
   - provenance and labels
3. Keep data collection in `apps/*/api` and keep rendering in `apps/*/web` or local tooling adapters.

### Phase 3: Interactive Views

1. Use MUI X Charts for throughput, backlog age, duration, and other metric dashboards.
2. Use React Flow if people need node manipulation or step-by-step workflow inspection.
3. Use Cytoscape.js only when the graph itself becomes the product problem.

## First Implementation Targets

### PR Change Visuals

- Build a small manifest from local git metadata.
- Render:
  - a Mermaid `gitGraph` or workflow-style summary for the storyline
  - a Mermaid or Graphviz impact map by app boundary or dependency cluster
  - an optional diff2html artifact only when reviewers need code-level diff rendering

### Workflow Monitoring And Review

- Start with Mermaid snapshots for docs, retrospectives, and design proposals.
- Add MUI X Charts when the view is numeric and belongs in an existing product web app.
- Introduce React Flow only if humans need interactive inspection of blocked items, handoffs, or long-running workflows.

## Agent Skill Implications

The reusable skill should do three things well:

1. Choose the lightest fitting renderer rather than defaulting to a complex graph library.
2. Keep the source-of-truth artifact text-first and local-first.
3. Separate static review artifacts from future interactive product surfaces so later implementations do not lock the repo into one rendering tool too early.

## Sources

- Mermaid intro: https://mermaid.js.org/intro/
- Mermaid architecture diagrams: https://mermaid.js.org/syntax/architecture.html
- Mermaid gitGraph diagrams: https://mermaid.js.org/syntax/gitgraph.html
- GitHub Docs, creating diagrams: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams
- D2 documentation: https://d2lang.com/
- Graphviz output formats: https://graphviz.org/docs/outputs/
- MUI X Charts overview: https://mui.com/x/react-charts/
- React Flow overview: https://reactflow.dev/
- React Flow SSR and SSG configuration: https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration
- Cytoscape.js docs: https://js.cytoscape.org/
- diff2html: https://diff2html.xyz/
