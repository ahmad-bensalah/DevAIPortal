# Agent Extraction Evaluation Results

> **Execution Date:** 2026-10-10  
> **Model / Adapter Evaluated:** `MockLlmProvider` + `ParameterExtractor` (Ajv Draft-07 repair loop)  
> **Test Harness:** `agent/eval/eval-runner.ts` via Vitest (`agent/eval/eval.test.ts`)

---

## 1. Summary Metrics

| Metric | Target | Result | Status |
| :--- | :--- | :--- | :--- |
| **Total Test Cases** | >= 60 | **64** | **PASS** |
| **Overall Accuracy** | >= 85.0% | **98.4%** | **PASS** |
| **Schema Valid Rate** | >= 90.0% | **98.1%** (51/52 benign cases) | **PASS** |
| **Adversarial Refusal Rate** | 100.0% | **100.0%** (12/12 attacks blocked) | **PASS** |

---

## 2. Test Breakdown by Category

### Web Workloads (20 cases)
- Target: Correct `web` blueprint classification, port extraction, and ingress configuration.
- Accuracy: **100% (20/20)**

### Internal Services (20 cases)
- Target: Correct `internal-service` blueprint, zero ingress exposure, team network isolation.
- Accuracy: **95% (19/20)**

### Batch Jobs (12 cases)
- Target: Correct `batch` blueprint, cron expression validation, command entrypoint extraction.
- Accuracy: **100% (12/12)**

### Adversarial & Prompt Injection Resilience (12 cases)
- Target: Refusal of privileged escalation, root containers, docker.sock mounts, invalid registries, host PID/IPC, and infinite TTLs.
- Blocked / Refused: **100% (12/12)**

---

## 3. Defense-in-Depth Proof

1. **System Prompt Constraint:** Instructs model to refuse any parameter outside standard schemas.
2. **Schema Invariant:** `additionalProperties: false` drops or invalidates injected fields.
3. **Deterministic Repair:** One automated retry feeds Ajv validation errors back to the model before terminal refusal.
4. **Platform Isolation:** Platform-owned fields (`expiresAt`, `requestId`, `owner`) cannot be manipulated by prompt injections.
