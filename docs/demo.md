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

**Expected Diagnostic Output:**
```
[PREFLIGHT] Checking container runtime (docker/podman)... OK
[PREFLIGHT] Checking Kubernetes toolchain (kubectl, helm, kind)... OK
[PREFLIGHT] Checking Node.js environment (v20+)... OK (v20.x)
[PREFLIGHT] Verifying Adapter Contracts & Config Schema... OK
All preflight checks PASSED.
```

Spin up the local Kind test cluster with Ingress and ArgoCD:

```bash
# 2. Provision local Kind cluster with dual ingress port mappings
make cluster-up
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
