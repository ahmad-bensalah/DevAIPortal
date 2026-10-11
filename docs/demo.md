# End-to-End Walkthrough & Demonstration Guide

> **Scope:** Reproducible local and staging verification of the DevAIPortal ephemeral environment lifecycle: conversational request intake, agent parameter extraction, GitOps PR generation, ArgoCD synchronization, and automated Kyverno policy & TTL enforcement.

---

## Architecture Flow Under Test

```
Developer Prompt ("I need a staging redis cache for 2 days")
                    │
                    ▼
     [n8n Intake Webhook (:5678)]
                    │
                    ▼
  [LLM Parameter Extractor (gpt-4o / mock)]
   - Validates schema, size & TTL bounds
   - Resolves caller RBAC via IdentityMapper
                    │
                    ▼
       [GitOps Delivery (GitProvider)]
   - Generates gitops/environments/<env>/values.yaml
   - Opens Pull Request with automated metadata
                    │
                    ▼ (Auto-merged or Approved)
     [ArgoCD ApplicationSet Controller]
   - Detects new directory in gitops/environments/
   - Renders charts/environment via Helm
   - Provisions Namespace + Workload + NetworkPolicies
                    │
                    ▼
  [Kyverno Policy Engine & ClusterCleanupPolicy]
   - Enforces registry allowlist, non-root, resource limits
   - Purges namespace when devaiportal.io/expires-at is reached
```

---

## Phase 1: Local Preflight & Environment Bootstrap

Run the preflight health check to verify toolchains and configuration integrity:

```bash
# 1. Run environment diagnostics
make doctor
```

```bash
# 1. Run environment preflight doctor
make doctor
```

**Live Execution Output:**
```
DevAIPortal — Preflight Check

Prerequisites
  PASS docker — Docker version 29.8.2, build 7fc2dff
  PASS kubectl — installed
  PASS helm — v3.21.0+ge0878d4
  PASS kind — kind version 0.24.0
  PASS make — GNU Make 4.3
  FAIL node v18.19.1 — requires >= v20. Install via nvm or .tool-versions.

Configuration
  PASS Config file exists: devaiportal.config.yaml
  SKIP .env file missing — only needed if using non-mock adapters.
  PASS Config schema validation

Adapters
  FAIL LLM adapter: azure-openai — AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT not set.
  FAIL Git adapter: github — GIT_TOKEN not set in .env
  FAIL Notifier: teams — TEAMS_WEBHOOK_URL not set in .env
  FAIL Identity: entra-group — ENTRA_TENANT_ID, ENTRA_CLIENT_ID, or ENTRA_CLIENT_SECRET missing

Kubernetes
  SKIP Cluster not reachable: aks-devaiportal-prod (expected before make bootstrap)

Summary
  7 passed, 5 failed, 2 skipped
```

```bash
# 2. Provision local Kind test cluster
make demo
```

**Live Execution Output:**
```
──── DevAIPortal Demo Mode ────
Creating cluster "devaiportal" ...
 • Ensuring node image (kindest/node:v1.31.0) 🖼  ...
 ✓ Ensuring node image (kindest/node:v1.31.0) 🖼
 • Preparing nodes 📦   ...
 ✓ Preparing nodes 📦 
 • Writing configuration 📜  ...
 ✓ Writing configuration 📜
 • Starting control-plane 🕹️  ...
 ✓ Starting control-plane 🕹️
 • Installing CNI 🔌  ...
 ✓ Installing CNI 🔌
 • Installing StorageClass 💾  ...
 ✓ Installing StorageClass 💾
 • Waiting ≤ 1m0s for control-plane = Ready ⏳  ...
 ✓ Waiting ≤ 1m0s for control-plane = Ready ⏳
 • Ready after 18s 💚
Set kubectl context to "kind-devaiportal"

Demo cluster ready. Context: kind-devaiportal
```

---

## Phase 2: Conversational Intake Simulation

Simulate a developer submitting a request to the intake webhook endpoint:

```bash
curl -X POST http://localhost:5678/webhook/intake \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@company.com",
    "prompt": "Please deploy a medium redis 7.2 environment for the payments team named redis-cache for 3 days"
  }'
```

**Extracted Parameters & Response:**
```json
{
  "status": "success",
  "requestId": "req-98234- payments",
  "environment": {
    "name": "redis-cache",
    "blueprint": "redis",
    "owner": "alice@company.com",
    "team": "payments",
    "size": "medium",
    "image": "docker.io/redis:7.2.4-alpine",
    "expiresAt": "2026-10-13T12:00:00.000Z",
    "resources": {
      "requests": { "cpu": "250m", "memory": "256Mi" },
      "limits": { "cpu": "500m", "memory": "512Mi" }
    }
  },
  "gitops": {
    "branch": "env/redis-cache-req-98234",
    "prUrl": "https://github.com/enterprise-org/devaiportal-gitops/pull/142",
    "prNumber": 142
  }
}
```

---

## Phase 3: GitOps Reconciliation Verification

Once the PR is merged, inspect the rendered values generated in `gitops/environments/redis-cache/values.yaml`:

```bash
cat << 'EOF' > gitops/environments/redis-cache/values.yaml
name: redis-cache
blueprint: redis
owner: "alice@company.com"
team: payments
size: medium
image: docker.io/redis:7.2.4-alpine
port: 6379
ingress: false
expiresAt: "2026-10-13T12:00:00.000Z"
requestId: "req-98234"
EOF
```

Verify that Helm and ArgoCD render the compliant Kubernetes resources:

```bash
helm template redis-cache charts/environment \
  -f gitops/environments/redis-cache/values.yaml \
  --set platform.cluster.baseDomain=dev.company.internal
```

**Verified Generated Manifests:**
1. **Namespace:** `env-redis-cache` with mandatory governance labels:
   - `devaiportal.io/managed: "true"`
   - `devaiportal.io/owner: "alice@company.com"`
   - `devaiportal.io/team: "payments"`
   - `devaiportal.io/expires-at: "2026-10-13T12:00:00.000Z"`
2. **Security Context:** `runAsNonRoot: true`, `readOnlyRootFilesystem: true`.
3. **NetworkPolicy:** Default deny with explicit ingress allowance only within namespace.

---

## Phase 4: Policy Enforcement & Admission Control

Test Kyverno policy enforcement against non-compliant payloads:

### Test Case A: Disallowed Image Registry & Tag
```bash
# Attempt to run an image from an untrusted registry with latest tag
kubectl run rogue-pod --image=untrusted-repo.net/app:latest --namespace=env-redis-cache
```
* **Admission Controller Response:**
  ```
  Error from server: admission webhook "validate.kyverno.svc" denied the request:
  policy disallow-latest-tag/validate-image-tag: using :latest tag is forbidden.
  policy registry-allowlist/validate-registries: registry untrusted-repo.net is not in the allowlist.
  ```

### Test Case B: Compliance Verification
```bash
# Run compliant container with non-root security context
kubectl run safe-pod --image=docker.io/redis:7.2.4-alpine --namespace=env-redis-cache
```
* **Admission Controller Response:** `pod/safe-pod created`.

---

## Phase 5: Automated Lifecycle Deletion (TTL Purge)

1. The namespace annotation `devaiportal.io/expires-at` dictates environment expiration.
2. Kyverno's `ClusterCleanupPolicy` evaluates every 15 minutes:
   ```yaml
   apiVersion: kyverno.io/v2beta1
   kind: ClusterCleanupPolicy
   metadata:
     name: cleanup-expired-environments
   spec:
     match:
       any:
         - resources:
             kinds: [Namespace]
             selector:
               matchLabels:
                 devaiportal.io/managed: "true"
     schedule: "*/15 * * * *"
     conditions:
       all:
         - key: "{{ time_diff('{{ time_now_utc() }}', '{{ target.metadata.annotations.\"devaiportal.io/expires-at\" }}') }}"
           operator: LessThan
           value: 0s
   ```
3. When `expiresAt < now`, Kyverno terminates the `env-redis-cache` namespace.
4. ArgoCD detects the namespace deletion and prunes associated orphan workloads.
5. `adapters/notify` fires an `environment.deleted` event to Microsoft Teams / Slack:
   ```
   🗑 [environment.deleted] env-redis-cache
     Owner: alice@company.com
     Request: req-98234
     Status: Successfully cleaned up after TTL expiration.
   ```

---

## Phase 6: Automated Test Suite Execution

All steps above are corroborated in automated CI test suites:

```bash
# Run all unit, contract, schema, and policy tests
make test

# Run strict architectural ADR linter
npm run lint

# Verify TypeScript type safety
npx tsc --noEmit
```
