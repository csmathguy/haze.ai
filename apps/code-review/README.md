# Code Review App Family

This app family is the local-first workspace for human review of agent-created pull requests.

It is also the intended place where humans make the final merge decision. Agents may prepare branches and PRs, but merge authority stays with a human reviewer.

- `api/` serves GitHub-backed PR list and detail data, review-lane classification, and later merge workflow hooks.
- `web/` renders the PR inbox, guided review lanes, trust checkpoints, and later PR walkthrough UX.
