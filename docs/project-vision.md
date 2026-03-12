# Project Vision

## Goal

Build a local-only web application that helps ingest tax documents, extract structured information, review missing or uncertain fields, and generate filing-ready outputs and reports.

## Primary Constraints

- Sensitive tax data must remain on the local machine unless the user explicitly chooses otherwise later.
- The application needs both a frontend and backend because document ingestion, extraction, validation, and reporting are different concerns.
- The codebase should be enterprise-ready from the start: typed interfaces, architecture boundaries, tests, linting, and repeatable workflows.

## Target User Flows

1. Import tax documents such as PDFs, spreadsheets, and images.
2. Extract normalized tax-relevant facts from those files.
3. Review low-confidence or missing fields in a guided UI with questionnaire-driven remediation.
4. Produce summary reports, spreadsheet exports, and filing inputs.
5. Maintain an auditable local trail of how final values were derived.
6. Track asset lots and compare disposal scenarios that reduce taxes while remaining within tax-law constraints.

## Non-Goals For The First Phase

- Multi-user auth
- Cloud sync
- Direct IRS submission
- Broad tax-law automation without explicit human review

## Delivery Phases

1. Foundation: repository standards, docs, workspace shape, and architecture rules
2. Ingestion: upload flow, secure local storage, extraction pipeline contracts
3. Review foundation: extraction records, questionnaire prompts, discrepancy tracking, and remediation workflow
4. Tax modeling: asset-lot tracking, scenario comparison, and tax-law rule modeling
5. Outputs: spreadsheet exports, reports, and filing packet generation
6. Hardening: higher test coverage, architecture enforcement, privacy controls, and auditability
