# Code Review API Instructions

- Keep GitHub access behind adapters or services so pull-request ingestion stays replaceable.
- Store or expose only the minimum PR metadata, diff summaries, and review evidence needed for human review.
- Keep repository indexing, explanation generation, and freshness logic explicit and testable.
- Do not put browser-facing UI logic in the API layer.
