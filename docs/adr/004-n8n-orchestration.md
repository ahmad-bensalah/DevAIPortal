# ADR-004: n8n as Orchestration Engine

* **Status**: Accepted
* **Date**: 2026-10-10
* **Deciders**: Platform Engineering Team, Senior SRE
* **Related ADRs**: [ADR-001](001-adapter-pattern.md), [ADR-003](003-gitops-delivery.md)

## Context

The platform requires a workflow engine to coordinate the end-to-end provisioning pipeline: receive a developer intent payload via webhook, call the LLM agent to extract typed parameters, validate parameters and check approval thresholds, open a GitOps pull request, send lifecycle notifications, and handle TTL reminders and error escalations.

This engine must satisfy the following constraints:
1. **Operable by platform engineers** who are not TypeScript developers.
2. **Observable**: workflow execution logs, retry UI, and step-level debugging.
3. **Version-controlled**: workflow definitions must live in Git alongside application code.
4. **Deployable on Kubernetes** without a paid SaaS license requirement.
5. **Adapter-compatible**: must invoke the platform's generic LLM, Git, Notify, and Identity sub-workflows without vendor-specific SDK knowledge.

## Decision

The platform uses self-hosted **n8n** as the orchestration engine. The ten workflows in `n8n/workflows/` are defined as JSON, version-controlled in this repository, structurally linted by `n8n/workflows.test.ts`, and imported on bootstrap via `scripts/import-n8n-workflows.sh`.

Business logic is delegated to sub-workflows (`llm.complete.json`, `git.open_pr.json`, `notify.send.json`, `identity.resolve_groups.json`) so that each integration concern is independently testable and replaceable. Credentials are managed by n8n's runtime credential store and injected as environment variables, never embedded in the workflow JSON files.

## Alternatives Considered

### Alternative A: AWS Step Functions / Azure Logic Apps
Managed, serverless orchestration on a cloud provider.
- **Rejection Rationale**: Creates hard vendor lock-in. The project must run on-premises, in air-gapped environments, and on any Kubernetes cluster. Step Functions require an AWS account; Logic Apps require Azure. Portability is a first-class requirement per ADR-001.

### Alternative B: Temporal (workflow-as-code in TypeScript)
Temporal provides durable execution with TypeScript SDK-based workflow definitions.
- **Rejection Rationale**: Temporal requires a managed Temporal server (or Temporal Cloud subscription). Its operational complexity — history sharding, replication, namespace configuration — is disproportionate to the provisioning volume this platform targets (< 100 requests/day). Temporal is appropriate when compensating transactions must survive for weeks; this platform's TTLs are days.

### Alternative C: Pure TypeScript Orchestration Script
A Node.js HTTP server or cron job coordinates the steps sequentially.
- **Rejection Rationale**: No built-in retry logic, dead letter handling, or execution history. Platform engineers without TypeScript knowledge cannot inspect or modify the flow without code changes and a full redeploy cycle. This approach fails the observability and operability constraints.

### Alternative D: Apache Airflow
Python-based DAG orchestration with a strong data pipeline ecosystem.
- **Rejection Rationale**: Airflow is Python-first; the rest of the platform stack is TypeScript. Mixing runtimes increases operational surface area. Airflow's DAG model is optimized for batch data pipelines; HTTP-triggered event-driven flows require custom operators and are a poor architectural fit for a real-time provisioning portal.

## Consequences

### Positive
* **No-code observability.** Platform engineers can inspect workflow execution, retry failed steps, and replay events via the n8n UI without touching TypeScript.
* **Vendor-neutral deployment.** n8n is open-source and runs as a single Docker container or Helm release on any Kubernetes cluster.
* **Separation of concerns.** Each integration point (LLM, Git, Notify, Identity) is a sub-workflow that can be replaced independently without touching intake orchestration logic.
* **Version-controlled workflow state.** All 10 workflow JSON files are stored in `n8n/workflows/`, linted by `n8n/workflows.test.ts`, and imported idempotently via a single script.

### Negative
* **n8n license risk.** n8n uses the Sustainable Use License for its cloud product. Self-hosted community edition is Apache-2.0 for non-commercial use. Commercial production deployments must verify license compliance before launch.
* **Workflow import is not fully automated on first boot.** `scripts/import-n8n-workflows.sh` requires a running n8n instance and cannot import during initial container startup. See `docs/limitations.md` §9.

### Mitigations
* **License risk**: Documented in `docs/limitations.md`. For commercial deployments, contact n8n directly for an enterprise license before production launch.
* **Import automation gap**: The import script is designed to be invoked by an init container or `make bootstrap` post-startup. This is tracked as a known gap in `docs/limitations.md` §9 with a concrete mitigation path.

## Verification

Structural lint of all 10 workflow files (JSON validity, no hardcoded credentials, no vendor locks):
```bash
npx vitest run n8n/workflows.test.ts
```

Verify the import script handles an unavailable n8n instance cleanly:
```bash
bash scripts/import-n8n-workflows.sh
# Expected: "Skipping live REST import. Workflows remain saved and linted in n8n/workflows."
```

## Open Questions / Revisit Triggers

* **n8n license change**: If n8n changes the community edition licensing to restrict self-hosting, revisit this ADR to evaluate Temporal or a purpose-built TypeScript orchestrator.
* **High-throughput requirements**: If the platform must handle > 500 provisioning requests per hour, revisit n8n's queue mode configuration and evaluate whether horizontal scaling of n8n workers is sufficient or a dedicated queue (BullMQ, RabbitMQ) should be introduced.
