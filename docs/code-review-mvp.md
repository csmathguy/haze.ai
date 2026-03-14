# Code Review MVP

Reviewed on March 14, 2026.

## Scope

- Audience: the human reviewer validating agent-created pull requests in this repository
- System area: `apps/code-review/api`, `apps/code-review/web`, GitHub pull-request intake, and planning backlog
- Output type: explanation and implementation-direction document

## Problem

Raw pull request diffs make it too easy for a reviewer to miss the value of a change, skim past risky sections, or trust automation without understanding the code. That risk increases when more changes are authored by agents. The product goal is not to replace human review. It is to help a human understand what changed, why it matters, what evidence exists, and whether the code deserves trust.

## Research Signals

### Review workflow

- GitHub's native review flow is anchored on changed files, comments, and review state, so the MVP should build on that mental model instead of inventing a completely different one.
- The GitHub REST API already exposes changed files and diff metadata for pull requests, which is enough to start a local-first ingestion adapter without a third-party middle layer.
- Bacchelli and Bird's modern code review research supports treating review as a knowledge-sharing and understanding activity, not only a defect filter.
- Google's reviewer guidance reinforces small scope, clear starting points, and explicit risk framing, which supports a guided review order instead of a flat file list.

### Human learning

- Karpicke and Blunt's retrieval-practice result suggests that active recall and explanation improve durable understanding more than passive rereading. Inference: the review app should use checkpoints and questions, not only passive summaries.
- The MVP should therefore expose reviewer questions per section, not only documentation-style prose.

### Gamification

- The research direction is promising only when it rewards coverage, consistency, and confidence building.
- Inference: avoid leaderboards, speed pressure, or point systems in the MVP because those can distort reviewer behavior away from careful inspection.

## MVP Boundary

The MVP should do four things well:

1. Pull live pull requests from this repository into a local-first review workspace.
2. Present a deterministic review order with lanes for context, risks, tests, implementation, validation, and docs.
3. Link the review thread back to planning context whenever a work item can be inferred from the PR branch or body.
4. Make the trust contract explicit: human review is the final confirmation step.

The MVP should not yet:

- index the repository for explanations
- persist reviewer notes
- trigger approval or merge actions from the web app
- add gamified incentives beyond planning and research notes

## Product Shape

### API

- Serve a typed review workspace and pull-request detail contract.
- Keep GitHub access behind an adapter seam so authentication and retrieval remain replaceable.
- Keep all data local-only, cache only the minimum review summary and diff data needed for rendering, and fall back to cached data when live GitHub retrieval is temporarily unavailable.

### Web

- Use a master-detail review-lane layout.
- Keep tests and validation separate from production-code detail, and split test evidence by unit, integration, and end-to-end slices when possible.
- Keep PR summary, linked planning context, and changed-file lanes visible without leaving the review surface.

### Freshness

- Treat explanation freshness as a first-class product concern.
- Tie future explanation refreshes to pull request head SHA changes and repository changes for touched paths.
- Show freshness metadata near generated explanations when that capability lands.

## Planned Work Breakdown

### MVP

- GitHub PR intake
- Sectioned review lanes
- Review workspace scaffold

### Next

- Interactive walkthrough
- Freshness and repository context sync

### Later

- Careful motivational mechanics

## Source Links

- GitHub Docs, reviewing proposed changes in a pull request: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request
- GitHub REST API, list pull requests files: https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files
- Microsoft Research, Expectations, Outcomes, and Challenges of Modern Code Review: https://www.microsoft.com/en-us/research/publication/expectations-outcomes-and-challenges-of-modern-code-review/
- Google Engineering Practices, reviewer guide: https://google.github.io/eng-practices/review/reviewer/
- Karpicke and Blunt, Retrieval Practice Produces More Learning than Elaborative Studying with Concept Mapping: https://www.science.org/doi/10.1126/science.1199327
