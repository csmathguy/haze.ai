# Code Review MVP

Reviewed on March 13, 2026.

## Scope

- Audience: the human reviewer validating agent-created pull requests in this repository
- System area: `apps/code-review/api`, `apps/code-review/web`, planning backlog, and future GitHub ingestion adapters
- Output type: explanation and implementation-direction document

## Problem

Raw pull request diffs make it too easy for a reviewer to miss the value of a change, skim past risky sections, or trust automation without understanding the code. That risk increases when more changes are authored by agents. The product goal is not to replace human review. It is to help a human understand what changed, why it matters, what evidence exists, and whether the code deserves trust.

## Research Signals

### Review workflow

- GitHub’s native review flow is anchored on changed files, comments, and review state, so the MVP should build on that mental model instead of inventing a completely different one.
- The GitHub REST API already exposes changed files and diff metadata for pull requests, which is enough to start a local-first ingestion adapter without a third-party middle layer.
- Bacchelli and Bird’s modern code review research supports treating review as a knowledge-sharing and understanding activity, not only a defect filter.
- Google’s reviewer guidance reinforces small scope, clear starting points, and explicit risk framing, which supports a guided review order instead of a flat file list.

### Human learning

- Karpicke and Blunt’s retrieval-practice result suggests that active recall and explanation improve durable understanding more than passive rereading. Inference: the review app should use checkpoints and questions, not only passive summaries.
- The MVP should therefore expose reviewer questions per section, not only documentation-style prose.

### Gamification

- The research direction is promising only when it rewards coverage, consistency, and confidence building.
- Inference: avoid leaderboards, speed pressure, or point systems in the MVP because those can distort reviewer behavior away from careful inspection.

## MVP Boundary

The MVP should do four things well:

1. Materialize a local-first code-review workspace in code, not only in planning notes.
2. Present a deterministic review order with lanes for context, tests, implementation, validation, and risks.
3. Make the trust contract explicit: human review is the final confirmation step.
4. Show the roadmap for GitHub intake, walkthroughs, and freshness so the scaffold is connected to the real product direction.

The MVP should not yet:

- ingest live pull requests from GitHub
- index the repository for explanations
- persist reviewer notes
- add gamified incentives beyond planning and research notes

## Product Shape

### API

- Serve a typed review-workspace contract.
- Add GitHub access later behind an adapter seam.
- Keep all data local-only and fetch the minimum GitHub payload needed for review.

### Web

- Use a master-detail review-lane layout.
- Keep tests and validation separate from production-code detail.
- Show roadmap and research context so the reviewer understands why the product behaves this way.

### Freshness

- Treat explanation freshness as a first-class product concern.
- Tie future explanation refreshes to pull request head SHA changes and repository changes for touched paths.
- Show freshness metadata near generated explanations when that capability lands.

## Planned Work Breakdown

### MVP

- Review workspace scaffold
- GitHub PR intake
- Sectioned review lanes

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
