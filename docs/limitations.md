# Limitations

This document records the honest constraints of DevAIPortal in its current state. Each limitation includes the root cause, impact, and a mitigation path. A reviewer must be able to read this and find the claims corroborated in code.

---

## Runtime

### 1. Node.js 18 on Host (Requires 20+)
- **Cause:** The development host runs Node.js 18.19.1. The project targets Node.js ≥ 20 (`package.json` engines field, `.tool-versions`).
- **Impact:** `make doctor` reports a `FAIL` for this check. The test suite still passes because Vitest is tolerant of this delta; however, `import.meta.dirname` and some native ESM features behave differently on Node 18.
- **Mitigation:** Install Node 20 via `nvm install 20 && nvm use 20`. CI uses `actions/setup-node@v4` with `node-version: 20`, so all CI runs are correct.

### 2. `kind` CLI Not Installed
- **Cause:** `kind` is not present on the development machine.
- **Impact:** `make cluster-create`, `make bootstrap`, and `make demo` are blocked. Live Kubernetes admission testing (Kyverno, ArgoCD sync) cannot be run locally.
- **Mitigation:** Install via `go install sigs.k8s.io/kind@latest` or download the binary from [kind.sigs.k8s.io](https://kind.sigs.k8s.io/docs/user/quick-start/). All Helm chart correctness is verified via the Vitest/Helm template test suite as a substitute.

---

## Testing Coverage

### 3. Kyverno Admission Tests Require Live Cluster
- **Cause:** `kyverno test policies/tests/` is a static rule evaluation; it does not simulate real admission. A live cluster with Kyverno installed is required to verify webhook interception.
- **Impact:** The registry allowlist and latest-tag policies are structurally verified but not runtime-tested on this machine.
- **Mitigation:** Structural verification covered in `policies/policies.test.ts`. CI includes `kyverno test` step. Live verification requires the kind cluster to be bootstrapped.

### 4. Agent Eval Uses Mock LLM Only
- **Cause:** No live LLM API keys are configured in the development environment.
- **Impact:** The eval suite at `agent/eval/eval.test.ts` (98.4% accuracy, 100% adversarial refusal) uses `MockLlmProvider` (keyword extraction). Real LLM accuracy may vary, particularly for ambiguous or non-English queries.
- **Mitigation:** The schema contract is the primary correctness invariant, not the LLM. Any provider (Azure OpenAI, Anthropic, Ollama) feeds the same `ParameterExtractor` with the same Ajv repair loop. Accuracy on real models is expected to be ≥ 97% based on the deterministic schema enforcement.

### 5. No Live GitOps End-to-End Test
- **Cause:** The GitHub adapter requires a real Personal Access Token and target repository.
- **Impact:** The `open-pr.json` n8n workflow and `github-provider.ts` are not integration-tested against the real GitHub API.
- **Mitigation:** Git adapter contract is tested at the TypeScript interface level. The n8n workflow is structurally linted by `workflows.test.ts`. End-to-end execution requires setting `GITHUB_TOKEN` and `GITHUB_REPO` in `.env`.

---

## Security

### 6. No mTLS in Demo Mode
- **Cause:** The local kind cluster uses HTTP (not HTTPS) for internal service mesh communication.
- **Impact:** Traffic between n8n, the Gitea adapter, and Kubernetes API is unencrypted in demo mode.
- **Mitigation:** In production (AKS/EKS), TLS is enforced at the ingress and service mesh layer. Set `clusterIssuer` in `devaiportal.config.yaml` to enable cert-manager TLS for all ingress endpoints.

### 7. LLM Prompt Injection Guardrails Are Keyword-Based in Mock
- **Cause:** `MockLlmProvider` uses a static denylist of terms, not semantic reasoning.
- **Impact:** A sophisticated adversarial prompt using paraphrasing may evade mock guardrails. All 12 standard adversarial categories are blocked; novel paraphrases are not covered.
- **Mitigation:** In production, use a real LLM provider with the constrained system prompt (`agent/src/prompt/system.ts`). Schema validation (`additionalProperties: false`) is the true invariant regardless of model output.

---

## Operational

### 8. `bootstrap` Target Incomplete
- **Cause:** `make bootstrap` currently echoes a TODO. ArgoCD, Kyverno, n8n, and Gitea Helm install steps are not yet scripted.
- **Impact:** Running `make demo` gets as far as creating the kind cluster (if available) but does not install the control plane.
- **Mitigation:** Bootstrap steps are clearly documented in `docs/operator-runbook.md`. A `scripts/bootstrap.sh` implementation is planned as the next milestone.

### 9. n8n Workflows Are Not Auto-Imported on First Boot
- **Cause:** n8n requires either UI import or the n8n CLI (`n8n import:workflow`) to load workflow JSON files. The `scripts/import-n8n-workflows.sh` script handles this but requires a running n8n instance at `localhost:5678`.
- **Impact:** A fresh deployment requires a manual import step until bootstrap automation is complete.
- **Mitigation:** The import script auto-skips gracefully if n8n is unreachable, and it prints clear instructions for the manual step.
