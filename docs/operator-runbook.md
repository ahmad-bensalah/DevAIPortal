# Operator Runbook

This document details day-to-day operations, failure triage, and incident responses for **DevAIPortal**.

---

## 1. Routine Operational Commands

```bash
# Check platform health and adapter connectivity
make doctor

# Validate configuration against schema
make validate-config

# Regenerate platform artifacts (Helm platform.yaml + Kyverno registry policies)
make render-platform

# Check for platform governance drift
make check-platform-drift

# Run unit and contract test suites
make test
```

---

## 2. Failure Triage & Remediations

### Incident 1: LLM Parameter Extraction Failure / Auto-Repair Exhaustion
* **Symptom**: Developer request receives `status: failed`, error message mentions schema non-conformance.
* **Root Cause**: Query lacked critical workload parameters (e.g., port for web service) or requested non-whitelisted registries.
* **Remediation**:
  1. Inspect n8n execution log for `req-<id>` to review raw LLM response.
  2. Verify if user query requested non-compliant resources (e.g. privileged ports < 1024).
  3. Advise developer to clarify port and blueprint profile.

### Incident 2: ArgoCD Sync Error on Ephemeral Environment
* **Symptom**: ApplicationSet creates Application, but status is `Degraded` or `OutOfSync`.
* **Root Cause**:
  * Pod Security Standard violation (e.g., pod attempted to mount host path or run as root).
  * Kyverno admission policy rejection (e.g., untagged image `:latest` or unapproved container registry).
* **Remediation**:
  ```bash
  # Check ArgoCD sync logs
  kubectl get application -n argocd env-<name> -o yaml

  # Check Kyverno policy events in cluster
  kubectl get events -n env-<name> --field-selector reason=PolicyViolation
  ```

### Incident 3: Orphaned Namespaces Past Expiry
* **Symptom**: Environment namespace persists beyond `devaiportal.io/expires-at` timestamp.
* **Root Cause**: Kyverno controller is offline or `ClusterCleanupPolicy` is suspended.
* **Remediation**:
  ```bash
  # Check Kyverno cleanup controller health
  kubectl get pods -n kyverno -l app.kubernetes.io/component=cleanup-controller

  # Manually inspect expired namespaces
  kubectl get ns -l devaiportal.io/managed=true --show-labels
  ```
