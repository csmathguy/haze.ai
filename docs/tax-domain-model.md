# Tax Domain Model

## Research Baseline

The initial domain is shaped around official IRS forms and guidance:

- Form 1040 and its instructions define the core return shell.
- Schedule B covers interest and dividend reporting.
- Schedule D and Form 8949 cover capital gains and losses from securities and digital assets.
- Form W-2, Form 1099-INT, Form 1099-DIV, Form 1099-B, Form 1099-DA, Form 1098, and Schedule K-1 drive major intake categories.
- IRS Publication 550 and the IRS virtual currency FAQs inform lot tracking, basis, and specific-identification decisions.

## Core Entities

### Household Profile

- tax year
- filing status
- state residence
- primary taxpayer identity label
- digital-asset participation flag

### Imported Document

- source filename
- MIME type
- tax year
- inferred document kind
- import timestamp
- missing facts still required for filing confidence
- workflow status such as `imported` or `needs-review`

### Review Task

- title and reason
- severity
- optional source document
- action label for guided remediation

### Tax Return Draft

- required federal forms
- income items
- deduction items
- household profile
- planner notes

### Asset Lot

- asset key and human label
- account name
- asset class such as equity or digital asset
- acquisition date
- quantity
- cost basis
- holding term
- source document linkage

### Tax Scenario

- lot selection method
- realized short-term gain
- realized long-term gain
- estimated federal tax
- narrative explaining the strategy

## Key Modeling Rules

- Keep raw uploaded documents separate from normalized tax entities.
- Missing facts are first-class data, not validation side effects.
- Represent money in integer cents to avoid floating-point errors.
- Keep lot-selection strategies explicit because FIFO, highest-basis, and specific-identification can change tax outcomes materially.
- Treat digital assets as property and track basis and acquisition dates with the same rigor as brokerage lots.

## Current Scaffold Coverage

- document intake metadata
- review queue generation
- required-form derivation
- empty asset-lot ledger
- zero-value scenario templates for future optimization logic

## Planned Next Additions

- extraction provenance and confidence scoring
- transaction history for buys, sells, transfers, and wash-sale-like reconciliations where applicable
- state-specific tax modeling
- taxpayer elections and carryovers
- filing packet output models for generated forms and attachments
