# ADR-003: GitOps Pull-Request Model for Environment Delivery

* **Status**: Accepted
* **Date**: 2026-10-10
* **Deciders**: Platform Engineering Team, Senior SRE
* **Related ADRs**: [ADR-001](001-adapter-pattern.md), [ADR-002](002-config-contract.md)

## Context

When a developer's intent is extracted and validated by the agent, the platform must provision a Kubernetes namespace and workload. Several delivery mechanisms exist: direct cluster API calls, server-side Helm installs from the orchestrator, and GitOps reconciliation via ArgoCD.

The platform manages ephemeral environments shared across multiple teams. The primary forces in tension are:

1. **Auditability**: Who requested what, when, and with which parameters?
2. **Security isolation**: The orchestration layer must not hold cluster-write permissions.
3. **Idempotency**: A repeated request with the same `requestId` must not provision a duplicate namespace.
4. **Rollback**: A provisioned environment must be reversible without raw cluster access.
5. **Policy enforcement**: Admission policies must fire on every deployment, including schema-validated values files.

## Decision

The platform uses a pull-request-based GitOps delivery model:

1. On approval, the orchestrator (n8n `open-pr.json` workflow) commits `gitops/environments/<name>/values.yaml` to a feature branch and opens a PR against `main`.
2. CI validates the values file against `values.schema.json` and runs `helm template` to verify rendering.
3. On merge, ArgoCD's `ApplicationSet` (git files generator on `gitops/environments/*/values.yaml`) detects the new path and deploys the corresponding `Application` using `charts/environment`.
4. ArgoCD enforces `prune: true` and `selfHeal: true`, correcting any out-of-band cluster mutation automatically.

The orchestrator holds only Git write access to feature branches. It has no `kubectl` credentials and no Kubernetes RBAC bindings.

## Alternatives Considered

### Alternative A: Direct `kubectl apply` from n8n
n8n executes `kubectl apply -f values.yaml` using a mounted kubeconfig inside the cluster.
- **Rejection Rationale**: Grants n8n a permanent kubeconfig with apply-scoped RBAC — a foothold that violates least-privilege. Any n8n workflow compromise grants direct cluster write access. There is no automatic audit trail beyond raw Kubernetes audit logs, and rollback requires manual intervention.

### Alternative B: Kubernetes API via a ServiceAccount from n8n
n8n uses an in-cluster ServiceAccount with namespace-scoped create/update permissions.
- **Rejection Rationale**: Helm releases require cluster-scoped permissions for CRDs and Namespaces. Maintaining Helm release state in-cluster (as Kubernetes Secrets) tightly couples the orchestrator to cluster secrets. Rollback requires `helm rollback`, not a Git revert.

### Alternative C: Argo Workflows as a secondary orchestration layer
n8n calls the Argo Workflows API to execute a template that runs `helm upgrade`.
- **Rejection Rationale**: Adds a second orchestration layer dependency. Argo Workflows and ArgoCD overlap in responsibility, and the additional operational surface area is not justified for the ephemeral environment provisioning use case (< 100 requests/day).

### Alternative D: Terraform per-environment state
A Terraform workspace per environment manages all Kubernetes resources via the Kubernetes provider.
- **Rejection Rationale**: Terraform state management (state locks, remote backends, drift detection) adds significant operational complexity for ephemeral resources with TTLs measured in days. TTL-triggered teardown requires separate `terraform destroy` invocations. Helm + Kyverno `ClusterCleanupPolicy` is a strictly simpler lifecycle model.

## Consequences

### Positive
* **Immutable audit trail.** Every provisioned environment is traceable to a Git commit SHA, author, and PR number. No cluster access is required to answer "who deployed what".
* **Least privilege.** The orchestrator's only credential is a Git token with branch-write scope. It has no Kubernetes API access.
* **Idempotent by default.** If the same `requestId` is submitted twice, the PR creation fails with "branch already exists" — no duplicate namespace.
* **Automatic drift correction.** ArgoCD `selfHeal: true` corrects any manual cluster mutation within the poll interval.
* **Rollback is a revert.** Environment deletion is `git rm gitops/environments/<name>/values.yaml` followed by an ArgoCD sync with `prune: true`.

### Negative
* **Delivery latency.** From PR merge to ArgoCD sync completion takes 30–120 seconds depending on ArgoCD poll interval. This is not suitable for sub-second provisioning requirements.
* **PR approval bottleneck.** For large or long-lived requests, a human must review and merge the PR, introducing variable latency. Auto-approval only applies to ≤ medium size and ≤ 7-day TTL.
* **Git repository SPOF.** If the GitOps repository is unavailable, no new environments can be provisioned. Existing environments remain running from ArgoCD cached state.

### Mitigations
* **Delivery latency**: ArgoCD webhook-triggered sync reduces effective delivery to < 30 seconds. `applicationset.yaml` poll interval is configurable.
* **PR bottleneck**: Approval thresholds are configurable via `devaiportal.config.yaml` (`approval.requireAboveSize`, `approval.requireAboveTtlDays`). See `docs/operator-runbook.md`.
* **Git SPOF**: Host the GitOps repository on a highly available Git provider (GitHub, GitLab). ArgoCD caches sync state; existing environments survive transient Git outages.

## Verification

Run the GitOps rendering and structural test:
```bash
npx vitest run gitops/gitops.test.ts
```

Verify all declared sample environments render correctly through Helm:
```bash
helm template env-sample charts/environment -f gitops/environments/sample-service/values.yaml
helm template env-notifications charts/environment -f gitops/environments/notifications-svc/values.yaml
helm template env-ledger charts/environment -f gitops/environments/ledger-reconciliation/values.yaml
```

Inspect AppProject restrictions and ApplicationSet generator:
```bash
cat gitops/appproject.yaml | grep -E "namespace|blacklist|Secret"
cat gitops/applicationset.yaml | grep -E "path|prune|selfHeal"
```

## Open Questions / Revisit Triggers

* **Webhook-triggered ArgoCD sync**: If ArgoCD webhook integration is configured, the poll interval becomes irrelevant. Revisit this ADR to document the webhook endpoint and token rotation policy.
* **Multi-cluster support**: If the platform must provision environments across more than one cluster, revisit the `AppProject.destinations` configuration and evaluate Argo's ApplicationSet multi-cluster generator.
