# Knowledge And Agent Memory Research

Researched on March 13, 2026.

## Scope

This note evaluates how the repository should model long-term memory for agents and humans, and how that memory should be stored so both web UIs and agents can consume it reliably.

## Short Answer

The strongest fit for this repository is a hybrid model:

- structured semantic memory for subjects such as humans, technologies, workflows, and projects
- collection-style knowledge entries for episodic notes, research, follow-ups, and repository-doc mirrors
- JSON-first content for reliable agent writes and filtering, with optional markdown narrative for human readability

That conclusion is an inference from the sources below. The sources agree on separating profile-style memory from collection-style memory, and on keeping memory scoped so retrieval is selective rather than global.

## Key Findings

### Memory types should stay distinct

- LangGraph's memory guidance distinguishes profile-style memory from collection-style memory and calls out namespaces for scoped recall.
- The CoALA paper frames language-agent memory in cognitive layers such as semantic, episodic, and procedural memory.
- Letta's memory docs separate persistent memory blocks from broader archival memory, which reinforces the same split between compact durable state and larger history.

Implication for this repo:

- keep `subjects` for semantic memory
- keep `entries` for episodic and research memory
- keep namespaces explicit for focused retrieval

### JSON is better for agent writes, but markdown still matters

- LangGraph explicitly recommends a profile document when the data shape is stable and collection storage when the memory units should remain separate.
- DeepAgents uses persistent memory files and repository instructions as part of the agent's working memory surface, which shows that human-readable narrative still has value.

Inference:

- use typed JSON fields and metadata for filtering, validation, and deterministic updates
- keep markdown or sectioned prose alongside the JSON so humans can review and learn from the same entry

### Knowledge needs provenance and freshness

- LangGraph recommends storing memories under clear namespaces.
- Letta and DeepAgents both treat memory as operational state, not just static notes.

Implication for this repo:

- store origin, visibility, subject linkage, and review timestamps with each entry
- keep repository-doc mirrors distinct from agent-authored notes
- treat doc synchronization as a managed import path, not as ad hoc copy-paste

## Recommended Repository Direction

1. Store semantic memory in subject profiles.
2. Store research, follow-ups, and agent notes as separate entries.
3. Keep entry content hybrid:
   - structured JSON for machine-friendly access
   - optional markdown for human-friendly rendering
4. Expose both a web UI and a CLI or skill path so agents are not forced to scrape the UI.
5. Mirror repository docs into knowledge entries so research can move out of `docs/` over time without losing referenceability.

## Sources

- LangGraph docs, "Memory", reviewed March 13, 2026: https://langchain-ai.github.io/langgraph/concepts/memory/
- DeepAgents docs, "Memory", reviewed March 13, 2026: https://docs.langchain.com/labs/deepagents/memory
- Letta docs, "Memory", reviewed March 13, 2026: https://docs.letta.com/guides/agents/memory
- Sumers et al., "Cognitive Architectures for Language Agents", arXiv:2309.02427, September 2023: https://arxiv.org/abs/2309.02427
