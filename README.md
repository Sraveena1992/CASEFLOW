# CASEFLOW — Living cases, clearer decisions

<p align="center"><img src="bundle/caseflow-logo.svg" alt="CASEFLOW" width="112"></p>
<p align="center"><strong>Every case. One clear next step.</strong></p>
<p align="center">Turn scattered information into living case records, visible blockers, evidence-backed decisions and traceable follow-through.</p>

<p align="center"><a href="https://caseflow-staging.onrender.com/landing.html">Product overview</a> · <a href="https://caseflow-staging.onrender.com/login.html">Sign in</a> · <a href="https://github.com/Sraveena1992/CASEFLOW">Source code</a></p>

## About CASEFLOW
CASEFLOW is a secure, role-aware case workspace for work that is too important to leave scattered across inboxes, documents and chat threads. Each situation becomes a living record with an owner, current state, blocker, evidence, next action and a history of changes. **Progress should be understandable, decisions should be reviewable, and completion should be supported by evidence.**

## Why CASEFLOW Exists
Important work stalls in the gaps between information and action. Context gets lost, ownership becomes unclear, evidence is separated from decisions, and teams cannot explain why a case changed. CASEFLOW brings those moving parts into one structured workflow: understand the situation, see what is known and missing, make a human decision, and track what happens next. It is not intended to be another chat window or an opaque automation layer.

## Core features
| Feature | Purpose |
|---|---|
| Living case records | Capture the situation, owner, state, blocker and next action. |
| Evidence & source notes | Keep supporting text and source labels with each case. |
| Role-based workspace | Separate Admin oversight from Account Manager case ownership. |
| Human-reviewed transitions | Accept or reject proposed case-state changes; proposals do not apply themselves. |
| Case history & audit events | Inspect recorded updates, evidence additions and review actions. |
| Correction workflow | Admins can request changes while preserving case-owner responsibility. |
| Agent Assurance | Five bounded, read-only checks across service health, session, case API, evidence/history and role context. |
| Evidence & AI Governance | Browser-local selectable PDF text extraction, page-level keyword search, deterministic term checks and human-labelled local decisions. |

## How it works
1. **Capture** the situation and desired outcome.
2. **Organize** evidence, source labels, blockers and next actions.
3. **Review** a proposed transition and its rationale.
4. **Decide** — an authorized human accepts or rejects it.
5. **Track** updates and decisions in the case history.
6. **Verify** completion only when supporting evidence exists.

## Who uses CASEFLOW?
- **Account Managers** create and maintain cases, add evidence and respond to correction requests.
- **Admins** oversee cases, inspect audit history, manage team access and run read-only assurance checks.

## Product principles

**Verified outcomes** matter more than attempted actions.
- Evidence before conclusions.
- Human authority over consequential decisions.
- Clear ownership and least-privilege access.
- Traceable changes and honest status reporting.
- An attempted action is not the same as a verified outcome.

## Current implementation & boundaries
The web workspace uses a JavaScript interface, Node.js service and PostgreSQL-backed shared case records, evidence and audit events. Anna runtime AI proposal support is available only in a connected Anna context; the external Render preview does not guarantee Anna AI availability.

The Governance Workspace currently performs **browser-local selectable-text PDF extraction**, page-level indexing, keyword search and deterministic term-presence checks. Its decision trail is stored in browser local storage, not the server audit database. It is not vector RAG, OCR, an AI compliance verdict or an immutable audit service. Scanned PDFs and visual/image inspection are not supported yet.

Agent Assurance is a bounded read-only diagnostic, not an autonomous agent or security certification. External actions are outside current scope unless an explicit, authorized integration is added and verified.

## Product direction
The longer-term direction is a reusable case-resolution engine for specialized workflows such as career operations, service resolution and business operations. These are roadmap directions, not claims that every specialized agent or third-party integration is live.

## Development
See `AUTH_SETUP.md` for environment and authentication setup. The repository includes source checks and Python tests for the Executa transition validator. Run the commands configured in `package.json` and the Python package's `uv` environment.

## Security & privacy
Authentication, role checks, CSRF protection and server-side shared records are part of the web workspace. Never commit credentials, API keys, session tokens or sensitive customer data. Governance PDF extraction does not upload the selected PDF; local decision records are device/profile-specific and are not central audit evidence.

## Feedback
Issues and constructive feedback: https://github.com/Sraveena1992/CASEFLOW/issues

**Built by Sraveena Sharma** · [@Sraveena1992](https://github.com/Sraveena1992)

No open-source license is currently declared. Public repository visibility does not itself grant reuse or redistribution rights.
