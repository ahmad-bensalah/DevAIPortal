# n8n Workflow Architecture

> This directory contains the **n8n orchestration workflows** that power DevAIPortal's event-driven pipeline.

## Workflow Inventory

| File | Role | Type | Called By / Calls |
| :--- | :--- | :--- | :--- |
| `intake.json` | Webhook receiver — entry point for all environment requests | **Main workflow** | External trigger (Slack/Teams/webhook) |
| `validate.json` | Schema validation of extracted parameters | **Main workflow** | Called after LLM extraction |
| `llm.complete.json` | Dispatches intent to the configured LLM adapter | **Sub-workflow** | Called by `intake.json` |
| `open-pr.json` | Formats GitOps values and opens a PR via the Git adapter | **Main workflow** | Calls → `git.open_pr.json`, `notify.send.json` |
| `git.open_pr.json` | Low-level Git adapter dispatch (creates branch + PR) | **Sub-workflow** | Called by `open-pr.json` |
| `notify.json` | Top-level notification dispatcher | **Main workflow** | Calls → `notify.send.json` |
| `notify.send.json` | Low-level notification adapter dispatch | **Sub-workflow** | Called by `notify.json`, `open-pr.json` |
| `expiry-reminder.json` | Scheduled cron — sends TTL warnings for expiring envs | **Main workflow** | Standalone scheduled trigger |
| `identity.resolve_groups.json` | Resolves user → group membership via Identity adapter | **Sub-workflow** | Called by `intake.json` |
| `error-handler.json` | Centralized error handler for all workflow failures | **Sub-workflow** | Referenced as error workflow |

## Why `notify.json` ≠ `notify.send.json` (Not Duplicates)

These two files serve **different architectural layers**:

- **`notify.json`** is an **orchestrator** — it receives a lifecycle event and delegates to the sub-workflow.
- **`notify.send.json`** is a **sub-workflow** (leaf node) — it contains the actual adapter dispatch logic.

The same parent → child pattern applies to `open-pr.json` → `git.open_pr.json`. This separation follows n8n best practices for reusable sub-workflows that can be called from multiple parent workflows.
