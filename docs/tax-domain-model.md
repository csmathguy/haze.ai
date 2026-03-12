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

### Document Extraction

- extractor key and lifecycle status
- timestamped parsing attempt metadata
- extracted field collection with confidence, provenance hint, and source page
- status message describing why a document still needs modeling or review

### Data Gap

- stable id and semantic key
- source document and optional extracted field linkage
- gap kind such as missing tax lot, source field, compliance question, or optimization input
- severity and open or resolved workflow state
- human-readable title and remediation description

### Questionnaire Prompt And Response

- prompt category such as household, income, asset lots, deductions, compliance, or optimization
- response type such as boolean, text, select, date, or currency
- optional source document or source gap linkage
- current answer value and answer timestamp
- tax-year scoping so prior-year answers do not silently bleed into current filings

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
- extraction attempt records and open data gaps
- questionnaire prompt generation based on imported documents and open gaps
- review queue generation
- required-form derivation
- empty asset-lot ledger
- zero-value scenario templates for future optimization logic

## Planned Next Additions

- parser adapters that populate extracted fields for W-2, 1099-INT, 1099-DIV, 1099-B, and crypto exports
- normalized transaction history for buys, sells, transfers, basis adjustments, and wallet-to-wallet moves
- explicit provenance links from extracted fields into downstream draft return items
- questionnaire branches for deductions, carryovers, filing elections, and state-specific obligations
- state-specific tax modeling
- taxpayer elections and carryovers
- filing packet output models for generated forms and attachments
