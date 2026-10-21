# 🚀 CASEFLOW

### From Evidence to Decisions. From Decisions to Verified Outcomes.

<p align="center">
  <strong>Your AI-powered workspace for managing complex situations, decisions, and next actions.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AI-Agentic%20Workflow-6C63FF?style=for-the-badge" alt="AI Workflow" />
  <img src="https://img.shields.io/badge/Platform-Anna-0A7B83?style=for-the-badge" alt="Anna Platform" />
  <img src="https://img.shields.io/badge/Status-Prototype-orange?style=for-the-badge" alt="Prototype" />
  <img src="https://img.shields.io/badge/Tests-6%20Passing-brightgreen?style=for-the-badge" alt="6 passing tests" />
</p>

<p align="center">
  <a href="https://github.com/Sraveena1992/CASEFLOW">📦 Repository</a> •
  <a href="https://github.com/Sraveena1992/CASEFLOW/issues">🐛 Report an Issue</a> •
  <a href="https://github.com/Sraveena1992/CASEFLOW/issues/new">💡 Suggest an Improvement</a>
</p>

---

## 🌟 What is CASEFLOW?

Real-world problems rarely stay in one place. Evidence lives in messages and documents, decisions happen across conversations, and important follow-ups get lost.

**CASEFLOW is an AI-assisted case-management prototype designed to turn evolving situations into structured, reviewable decisions and actionable next steps.**

Instead of treating every problem as a one-off chat, CASEFLOW organizes it as a living case with context, evidence, blockers, proposed changes, human decisions, and a history of what happened.

Our long-term vision is to build a trusted agentic AI platform that helps individuals and businesses move from **intent → evidence → decision → authorized action → verified outcome**.

> 💡 **Core principle:** An action being attempted is not the same as an outcome being verified.

## 🎯 The Problem We Want to Solve

People and businesses constantly deal with:

- 📄 Scattered documents, messages, and evidence
- 🔎 Missing information and conflicting claims
- ⏳ Unresolved cases, delays, and forgotten follow-ups
- 🤔 Decisions without a clear record of why they were made
- 🔁 Repeated manual work across disconnected tools
- ✅ Difficulty distinguishing a proposed action from a completed outcome

CASEFLOW aims to make these situations more structured, transparent, and easier to manage.

## ✨ Current Prototype Capabilities

| Capability | What it does |
| :--- | :--- |
| 🗂️ Living Cases | Organizes a situation, current state, blocker, and next action |
| 📎 Evidence Capture | Keeps relevant evidence associated with a case |
| 🧠 AI-Assisted Analysis | Helps prepare proposed state changes and next steps |
| 🛡️ Human Review | Allows users to confirm or reject proposed transitions |
| 🧾 Case History | Records case events and decisions |
| 💾 Browser Persistence | Retains case data in the browser's local storage |
| 🔍 Transition Validation | Checks whether a proposed transition contains the required information |

**Transparency matters:** the current validator does not independently authenticate evidence. Browser-local storage is not a shared multi-user database, and the current prototype does not provide production-ready external payment, job-application, tax-filing, or logistics execution.

## 🔄 How CASEFLOW Works

1. **Create a case** — describe the situation and its desired outcome.
2. **Capture evidence** — organize relevant records and information.
3. **Analyze the situation** — review a proposed state change and its rationale.
4. **Check for gaps** — identify missing information before acting.
5. **Make a human decision** — accept or reject the proposal.
6. **Record the result** — preserve the case state and decision history.
7. **Continue toward resolution** — identify the next useful action.

```mermaid
flowchart TD
    A["🎯 Define the Goal"] --> B["🗂️ Create a Living Case"]
    B --> C["📎 Capture Evidence"]
    C --> D["🧠 Analyze & Propose"]
    D --> E{"🛡️ Human Review"}
    E -->|Approve| F["✅ Apply Proposed Transition"]
    E -->|Reject| G["↩️ Preserve Current State"]
    F --> H["🧾 Record History"]
    G --> H
    H --> I["➡️ Identify Next Action"]

🧪 Example: Vendor Payment Delay
Imagine a business has a delayed supplier payment and conflicting invoice information.

CASEFLOW can help organize the case, capture available evidence, surface missing information, propose a state change for human review, and record the resulting decision.

It should not label a discrepancy as fraud without evidence, or claim that a payment has completed simply because someone initiated it.


---

```markdown
## 🧭 Our Product Vision

CASEFLOW is designed around one shared workflow engine, with specialized experiences planned for different needs.

| Planned experience | Intended use |
| :--- | :--- |
| 👤 Personal Agent | Personal tasks, bills, documents, and follow-ups |
| 💼 Career Agent | Job discovery, application preparation, and application tracking |
| 🧰 Resolution Agent | Refunds, disputes, complaints, and service issues |
| 🏢 Business Operations Agent | Invoices, suppliers, buyer discovery, and operational workflows |
| 🌐 Integration Layer | Authorized connections to external services, where available |

These are roadmap directions, not claims that every agent or integration is already implemented.

## 🛠️ Technology & Development

- **Anna App Platform** — application runtime and AI integration
- **JavaScript** — browser-based user interface
- **Python** — CASEFLOW Executa transition validation
- **Python `unittest`** — automated validation tests
- **Browser Local Storage** — prototype case persistence

### Run locally

Requirements: Windows, Node.js/npm, Python managed through `uv`, and the Anna App CLI.

```powershell
# Navigate to the project
cd C:\Users\acer\caseflow

# Validate the application
anna-app.cmd validate --strict

# Run automated tests
& "$env:APPDATA\uv\python\cpython-3.14-windows-x86_64-none\python.exe" -m unittest discover -s tests -v

# Start the local Anna app runtime
anna-app.cmd dev --slug caseflow --no-watch

If the runtime starts successfully, open the local dashboard URL printed in the terminal (expected in the current setup: http://localhost:5180/).

Note: the local runtime has previously encountered a Python bridge startup timeout. A successful validation or test run does not by itself guarantee that the runtime will launch on every machine.

🔐 Security, Trust & Human Control
CASEFLOW's design principles:

🛡️ Human review for proposed state transitions

🔎 Clear distinction between evidence and assumptions

🚫 No unsupported claims of independent evidence verification

🧾 Traceable case history and recorded decisions

🔑 External actions should require appropriate permissions and authorization

✅ Completion claims should be backed by observable evidence

Production deployment will require additional work, including secure authentication, server-side persistence, access control, secret management, integration security, recovery, and privacy safeguards.

🗺️ Roadmap
[ ] Structured case-management prototype

[ ] Evidence capture and case history

[ ] AI-assisted transition proposals

[ ] Human approval and rejection flow

[ ] Executa transition validation tests

[ ] Improve end-to-end runtime reliability

[ ] Build a reusable goal-to-outcome execution engine

[ ] Add evidence-linked decisions and stronger audit records

[ ] Implement authorized external integrations

[ ] Verify real action outcomes

[ ] Add secure multi-user workspaces

[ ] Test with real users and measure resolution outcomes

🤝 Contributing & Feedback
Ideas, issue reports, and constructive feedback are welcome.

🐛 Open an issue

💡 Suggest an enhancement

👀 Explore the source code

👩‍💻 Built by
Sraveena Sharma

GitHub: @Sraveena1992

📜 License
No open-source license has been declared yet. Unless a license is added, public visibility does not automatically grant permission to reuse, modify, or redistribute the source code.
