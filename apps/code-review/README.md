# Code Review App Family

This app family is the local-first workspace for human review of agent-created pull requests.

It is also the intended place where humans make the final merge decision. Agents may prepare branches and PRs, but merge authority stays with a human reviewer.

- `api/` serves review workspace data and future GitHub ingestion adapters.
- `web/` renders guided review lanes, trust checkpoints, and PR walkthrough UX.
