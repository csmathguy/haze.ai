---
name: backlog-refinement
description: Use this skill when triaging, grooming, splitting, or validating backlog items before implementation. Apply it when the user wants issues made clearer, smaller, better prioritized, or turned into dependable plan items with explicit dependencies and eval coverage.
---

# Backlog Refinement

## Overview

Use this skill to turn rough backlog items into execution-ready work. The goal is not to rewrite everything, but to ask the minimum questions needed to decide whether an item should be kept, split, blocked, deprioritized, or promoted to ready.

This skill includes an eval loop so the behavior can be checked against representative backlog items instead of relying on anecdote.

## When To Use It

- A backlog item is vague, oversized, or missing acceptance criteria.
- The user wants help deciding whether to keep an issue at all.
- Dependencies, risks, or sequencing are unclear.
- The backlog needs to be broken into smaller work items.
- A planning pass should be research-backed and repeatable.

## Workflow

1. Read `AGENTS.md`, `docs/agent-guidelines.md`, and `docs/architecture.md`.
2. Read `references/refinement-rubric.md` before changing any item.
3. Inspect the candidate item and classify it as one of:
   - keep
   - clarify
   - split
   - block
   - drop
4. Ask only the questions that change the decision.
   - Prefer targeted questions about outcome, scope, constraints, dependencies, and success criteria.
   - Do not ask for implementation details unless they affect sequencing or risk.
5. Update the item with:
   - a sharper problem statement
   - observable acceptance criteria
   - tasks or subtasks
   - dependencies
   - explicit assumptions and open questions
   - a recommendation to keep, split, block, or drop
6. If the item is too large, create separate follow-up work items rather than burying future work in notes.
7. If the item should not proceed, record why and what condition would make it viable later.
8. If the item is ready, preserve the smallest truthful scope and hand it to the execution workflow.

## Eval Loop

Evaluate this skill against a fixed set of backlog cases before trusting it on live grooming.

### Eval Goals

- Does the skill ask useful questions instead of generic ones?
- Does it correctly decide when an item should be kept, split, blocked, or dropped?
- Does it surface dependencies and acceptance criteria that a human would actually use?
- Does it avoid over-refining low-value or low-confidence items?
- Does it create follow-up work items when scope clearly spills over?

### Eval Inputs

Use a small but mixed benchmark set:

- one vague feature request
- one oversized feature
- one dependency-heavy item
- one likely duplicate or low-value item
- one clearly ready item

### Eval Output Shape

For each test item, record:

- classification
- the top 3 questions asked
- whether the item was split
- whether dependencies were identified
- whether the result is ready for planning

### Eval Rubric

Score each case from 1 to 5 in these categories:

- decision quality
- question quality
- dependency detection
- scope control
- usefulness to the planning workflow

Treat a pass as:

- no catastrophic misclassification
- no missing critical dependency
- no unnecessary questioning on already-ready items
- at least one concrete improvement to the item or its follow-up work

### Eval Practice

- Run the skill on the same benchmark set after prompt changes.
- Compare results to the previous run rather than judging in isolation.
- Keep one reference output per benchmark item so regressions are visible.
- If the skill repeatedly misses the same kind of issue, change the skill or the benchmark, not just the prompt wording.

## Rules

- Prefer concise, testable backlog items over long narrative notes.
- Do not force every issue into a ready state.
- Do not keep future work in chat when it should be a separate backlog item.
- Use research findings to inform refinement, but separate facts from inference.
- Keep the output truthful even when the best answer is to drop the item.
