# DevAIPortal

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-v1.31+-326ce5.svg?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-v3.16+-0f1689.svg?logo=helm&logoColor=white)](https://helm.sh/)
[![ArgoCD](https://img.shields.io/badge/GitOps-ArgoCD-ef6b48.svg?logo=argo&logoColor=white)](https://argoproj.github.io/cd/)
[![Kyverno](https://img.shields.io/badge/Policy-Kyverno-009688.svg?logo=kyverno&logoColor=white)](https://kyverno.io/)

> **Internal Developer Platform (IDP)** delivering conversational self-service ephemeral Kubernetes environments via GitOps, deterministic blueprints, and declarative policy enforcement.

---

## Executive Overview

Modern platform teams struggle between two extremes: granting raw `kubectl` access (which compromises cluster security, compliance, and budget governance) or requiring manual DevOps ticketing (which bottlenecks developer delivery velocity).

**DevAIPortal** solves this by establishing a controlled self-service bridge:
1. **Developers request environments in plain language** (e.g., via Slack, Teams, or Webhook):  
   `"Need an isolated web service named payment-gateway with a 3-day lifetime for team payments"`
2. **Deterministic Extraction:** A constrained LLM pipeline converts intent into **strictly typed parameters** validated against a schema contract. The LLM **never** writes manifests and **never** accesses the cluster API.
3. **Audited Delivery:** GitOps pull requests drive immutable Helm blueprints.
4. **Active Governance:** ArgoCD synchronizes desired state, while **Kyverno** enforces Pod Security Standards (`restricted`), zero-trust network perimeter isolation, and automated garbage collection when environments expire.

```
+-----------------------------------------------------------------------------------+
|                                 DEVELOPER PORTAL                                  |
|  "Deploy payment-svc with 3d TTL"                                                 |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        INTENT EXTRACTION & SCHEMA CONTRACT                        |
|  Agent (Azure OpenAI / Anthropic) ➔ JSON Schema Validation (Deterministic State)  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                                GITOPS PULL REQUEST                                |
|  Git Provider (GitHub / GitLab) ➔ environments/<env-name>/values.yaml             |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                         KUBERNETES RUNTIME (AKS / EKS)                           |
|  ArgoCD (ApplicationSet) ➔ Helm Blueprint ➔ Kyverno Admission & Network Policies |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                         LIFECYCLE & AUTOMATED PURGE                               |
|  TTL Controller (Kyverno ClusterCleanupPolicy) deletes expired namespaces         |
+-----------------------------------------------------------------------------------+
```

---

## Architectural Principles

### 1. The Core Invariant
> **"The AI proposes, Git and declarative policies decide."**

No raw YAML generation. No direct cluster mutations. The LLM outputs strict JSON matching `values.schema.json`. Every cluster state change is auditable in Git version history.

### 2. Defense in Depth
Every ephemeral environment is provisioned with non-negotiable security baselines:
* **Namespace Boundary:** Labelled with Pod Security Standards `enforce: restricted`.
* **Resource Governance:** Mandatory `ResourceQuota` and `LimitRange` derived from standardized tiers (`small`, `medium`, `large`).
* **Zero-Trust Network:** Default-deny ingress/egress `NetworkPolicy`, explicit DNS egress only, and isolated inter-service communication.
* **RBAC Hardening:** Namespaced `Role` and `RoleBinding` resolved via identity provider (Azure Entra ID / OIDC). Pod service accounts operate with automounted tokens disabled.
* **Automated Expiry:** `devaiportal.io/expires-at` RFC3339 metadata drives scheduled namespace deletion via Kyverno `ClusterCleanupPolicy`.

### 3. Hexagonal / Adapter Pattern
External systems operate behind typed contracts (`interfaces`). Adapters are selected dynamically via configuration:

| Domain | Interface | Enterprise Adapters | Local / Air-Gapped Adapters |
| :--- | :--- | :--- | :--- |
| **LLM Engine** | `LlmProvider` | `azure-openai`, `openai`, `anthropic` | `ollama`, `mock` |
| **Git SCM** | `GitProvider` | `github`, `gitlab` | `gitea` |
| **Notifications** | `Notifier` | `teams`, `slack`, `email` (SMTP) | `console` |
| **Identity / RBAC**| `IdentityMapper` | `entra-group` (Azure AD), `oidc-group` | `static-user` |
| **Secret Store** | `SecretSource` | `external-secrets`, `kubernetes` | `env` |

---

## Repository Layout

```
.
├── charts/
│   └── environment/           # Production Helm chart (web, internal, batch blueprints)
│       ├── Chart.yaml
│       ├── values.schema.json # Single contract between Agent, Git, and Helm
│       ├── files/platform.yaml# Generated platform governance settings
│       └── templates/         # Baseline + profile-specific workload manifests
├── policies/                  # Kyverno policies (registry allowlist, TTL cleanup, PSA)
├── gitops/                    # ArgoCD AppProject and ApplicationSet configurations
├── agent/                     # Standalone parameter extraction library & eval harness
├── adapters/                  # Pluggable vendor integrations (Git, Notify, Identity)
├── n8n/                       # Orchestration workflows (Webhook intake, PR creation)
├── scripts/                   # Setup wizard, doctor preflight, platform rendering
├── docs/                      # Architecture Decision Records (ADRs) & SRE runbooks
├── devaiportal.config.yaml    # Non-secret environment configuration
└── Makefile                   # Unified operator entrypoints
```

---

## Quickstart

### Prerequisites
* Docker Engine 24+
* `kubectl` 1.30+
* Helm 3.16+
* Node.js 20+
* `make`

### Installation & Preflight
```bash
# 1. Clone repository
git clone git@github.com:ahmad-bensalah/DevAIPortal.git
cd DevAIPortal

# 2. Install platform dependencies
make deps

# 3. Interactive environment configuration
make setup

# 4. Run preflight doctor (verifies adapters, credentials, and cluster health)
make doctor
```

### Running Test Suites
```bash
# Run unit, schema, and adapter contract tests
make test
```

---

## Production Deployment (Azure & AKS Reference)

1. **Target Cluster:** Configure `devaiportal.config.yaml` to point to your AKS cluster context (`aks-devaiportal-prod`).
2. **Credentials:** Set up `.env` with Azure Service Principal credentials:
   ```bash
   AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
   AZURE_OPENAI_API_KEY=<token>
   AZURE_OPENAI_DEPLOYMENT=gpt-4o
   ENTRA_TENANT_ID=<tenant-id>
   ENTRA_CLIENT_ID=<client-id>
   ENTRA_CLIENT_SECRET=<client-secret>
   ```
3. **Bootstrap GitOps Engine:**
   ```bash
   make bootstrap
   ```

---

## Testing & Quality Assurance

| Suite | Command | Status |
| :--- | :--- | :--- |
| **All tests** | `make test` | 11 files, 87 tests passing |
| **Config schema** | `npx vitest run config/` | 13/13 |
| **Helm guardrails** | `npx vitest run charts/` | 12/12 (3 valid renders, 7 invalid rejected, 3 golden snapshots) |
| **Kyverno policies** | `npx vitest run policies/` | 12/12 (5 admission policies + cleanup TTL logic + 6 CLI suites) |
| **GitOps rendering** | `npx vitest run gitops/` | 3/3 (all env dirs rendered) |
| **Adapter contracts** | `npx vitest run adapters/` | 30/30 (Git: GitHub/GitLab/Gitea; Notify: Console/Teams/Slack/Email; Identity: Static/OIDC) |
| **Agent eval (Mock)** | `npx vitest run agent/` | 98.4% accuracy, 100% adversarial refusal (64 cases) |
| **n8n workflow lint** | `npx vitest run n8n/` | 4/4 |
| **ADR standard** | `npx tsx scripts/lint-adrs.ts` | All 4 ADRs pass |

For an end-to-end lifecycle walkthrough see [`docs/demo.md`](docs/demo.md).  
For detailed evaluation metrics see [`docs/eval-results.md`](docs/eval-results.md).  
For honest verification status see [`docs/status.md`](docs/status.md).

---

## Documentation

* [End-to-End Walkthrough & Demo](docs/demo.md)
* [Architecture Decision Records (ADRs)](docs/adr/)
* [Threat Model](docs/threat-model.md)
* [Limitations](docs/limitations.md)
* [Operator Runbook](docs/operator-runbook.md)
* [Credentials & Minimum IAM Scopes](docs/credentials.md)
* [Architecture Assumptions](docs/assumptions.md)
* [Evaluation Results](docs/eval-results.md)
* [Status & Verification Matrix](docs/status.md)
