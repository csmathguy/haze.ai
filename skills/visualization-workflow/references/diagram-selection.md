# Diagram Selection

Reviewed on March 14, 2026.

Audience: agents creating local-first diagrams and visuals for repository docs, PR review, workflow monitoring, and product web apps.

## Default Order

1. Mermaid for checked-in Markdown artifacts and review-friendly diagrams.
2. Graphviz for generated dependency or impact graphs.
3. D2 for cleaner container diagrams and export-oriented architecture views.
4. MUI X Charts for in-app numeric dashboards in the existing React stack.
5. React Flow for interactive node-based inspection or editing.
6. Cytoscape.js for larger graph analysis and graph-heavy interactive filtering.

## Selection Matrix

| Need | Default | Switch When | Notes |
| --- | --- | --- | --- |
| PR change summary in docs or PR text | Mermaid | Layout becomes too dense or you need a generated dependency graph | Mermaid renders in GitHub Markdown and includes `gitGraph` support. |
| Generated repository impact graph | Graphviz | Humans need hand-edited source more than machine-generated layout | DOT is well suited to generated graphs and has multiple layout engines and outputs. |
| Architecture or workflow overview for docs | Mermaid | Container layout or styling becomes awkward | D2 is stronger for polished container diagrams and local CLI export. |
| Existing product dashboard or monitoring panel | MUI X Charts | The view is graph-first instead of metric-first | This aligns with the current MUI stack and keeps chart code inside React. |
| Interactive workflow editor or inspectable graph | React Flow | Graph scale and analysis needs exceed editor-style interaction | React Flow is ideal when node editing and custom React nodes matter. |
| Large graph analysis or headless graph processing | Cytoscape.js | The view is really a static artifact rather than an analytic graph | Cytoscape.js supports graph analysis and headless Node.js use. |
| Code-level diff rendering in HTML | diff2html | Reviewers only need structural summaries | Treat this as a diff viewer, not the primary architecture-visualization layer. |

## Repo-Specific Rules

- Prefer source-controlled text formats over binary assets.
- Keep rendered SVG or PNG outputs optional or derived when possible.
- Keep exact values, labels, and a prose summary next to every chart or diagram.
- Keep raw tax data, full diffs, and workflow snapshots local; do not depend on hosted rendering services.
- When a diagram will live in GitHub-rendered Markdown, validate the syntax against GitHub-supported Mermaid features rather than only local Mermaid features.
