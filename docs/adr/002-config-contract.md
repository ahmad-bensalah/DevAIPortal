# ADR-002: Single Source of Truth Configuration Contract with JSON Schema and Generated Platform Governance

* **Status**: Accepted
* **Date**: 2026-10-10
* **Deciders**: Platform Architecture Team, Senior SRE
* **Related ADRs**: [ADR-001](001-adapter-pattern.md)

## Context
DevAIPortal requires centralized operational choices for adapter selection, cluster routing, namespace naming, resource quotas, and TTL bounds. Platform engineers configure these settings across varied environments (local kind, enterprise AKS/EKS). Secrets (API keys, OAuth tokens) must remain strictly segregated from non-secret operational parameters. Two failure modes threaten the platform: silent configuration drift between the Helm charts and Kyverno admission controls, and accidental credential leakage into Git repositories or logs.

## Decision
We enforce a strict separation of concerns via a unified non-secret configuration file, draft-07 JSON Schema validation, and code-driven policy generation:
1. **Single Source of Truth**: All non-secret platform settings reside in [`devaiportal.config.yaml`](../../devaiportal.config.yaml), committed to Git. A top-level `version: v1` field is mandatory.
2. **Schema Contract**: [`devaiportal.config.schema.json`](../../devaiportal.config.schema.json) validates the file via Ajv with `additionalProperties: false` at all levels. Any misspelled, misplaced, or legacy key fails fast with exact JSON path error reporting.
3. **No Overrides Precedence**: Precedence is fixed as `Hardcoded Schema Defaults < devaiportal.config.yaml`. Environment variable overrides for non-secret configuration are explicitly rejected to prevent invisible runtime mutations and preserve GitOps auditability.
4. **Platform & Policy Generation**: [`scripts/render-platform.ts`](../../scripts/render-platform.ts) (`make render-platform`) deterministically generates [`charts/environment/files/platform.yaml`](../../charts/environment/files/platform.yaml) and the Kyverno ClusterPolicy [`policies/registry-allowlist.yaml`](../../policies/registry-allowlist.yaml) directly from the config file. CI fails immediately if committed artifacts drift (`make check-platform-drift`).
5. **Secrets Architecture**: Secrets reside exclusively in `.env` for local execution, Kubernetes `Secret` for cluster runtimes, and External Secrets Operator (ESO) with Azure Key Vault / HashiCorp Vault as the production standard. Git ignores `.env`, and secret leakage is defended via Gitleaks in pre-commit and CI.

## Alternatives Considered

### Alternative 1: Environment Variables Only (12-Factor App)
* **Description**: Store all adapter selections, quota tiers, and TTL thresholds in environment variables.
* **Rejection Rationale**: Complex hierarchical structures (such as size-to-resource quota mappings across small/medium/large tiers) become unmaintainable and unreadable when flattened into strings. Environment variables cannot be validated against JSON Schema at compile time and eliminate GitOps versioning for platform config.

### Alternative 2: Helm Values Files as the Direct Platform Config
* **Description**: Maintain platform settings directly inside `charts/environment/values.yaml` and pass them to downstream services.
* **Rejection Rationale**: Binds external modules (the standalone agent library, doctor preflight script, and n8n workflows) to Helm-specific tooling. Non-Kubernetes tooling would need a YAML/Helm templating engine to inspect simple configuration keys.

### Alternative 3: CUE or Pydantic as the Schema & Validation Authority
* **Description**: Define configuration in CUE or Python Pydantic models and export to YAML/JSON.
* **Rejection Rationale**: Introduces a secondary language runtime (Go/CUE or Python) into a platform whose orchestration and runtime components are built on Node.js/TypeScript and Helm. JSON Schema draft-07 is the native industry standard supported by Helm (`values.schema.json`) and VSCode.

### Alternative 4: Kubernetes CustomResourceDefinition (CRD) or ConfigMap
* **Description**: Model the platform configuration as an in-cluster `DevPortalConfig` custom resource.
* **Rejection Rationale**: Requires an active Kubernetes cluster just to run unit tests, doctor preflights, local evaluation harnesses, or mock pipelines. Breaks the portability invariant that allows running offline without cluster access.

## Consequences

### Positive
* **Deterministic Synchronization**: Helm blueprints and Kyverno admission policies read the exact same registry and quota definitions; policy bypass via template drift is mathematically impossible.
* **Fail-Fast Ergonomics**: Typographical errors in configuration halt execution before any container starts or Git commit is made, naming the exact offending JSON path.
* **Immutable Audit Trail**: Changes to platform boundaries (e.g. extending max TTL or adding container registries) are reviewed through standard Git pull request workflows.

### Negative
* **Strict Schema Friction**: `additionalProperties: false` causes any renamed or newly added configuration parameter to immediately break older configurations during upgrades.
* **Build-Time Generation Burden**: Developers and operators must remember to run `make render-platform` whenever `devaiportal.config.yaml` changes, or CI will fail.
* **Testing Complexity for Interactive Setup**: Interactive bash wizard scripts (`scripts/setup.sh`) are difficult to unit-test across diverse shell environments without pty emulation.

### Mitigations
* **For Strict Schema Friction**: Handled by top-level schema versioning (`version: v1`) with migration tests in [`config/config.test.ts`](../../config/config.test.ts).
* **For Build-Time Generation Burden**: Enforced automatically by a drift detection test in Vitest and CI (`make check-platform-drift`), failing pre-merge if generated files do not match.
* **For Interactive Setup**: The setup wizard is supplemented by an immutable reference template ([`devaiportal.config.example.yaml`](../../devaiportal.config.example.yaml)) validated continuously against the schema in [`config/config.test.ts`](../../config/config.test.ts). Secret scanning is actively enforced by Gitleaks ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).

## Verification
* Run schema and negative validation tests:
  `npx vitest run config/config.test.ts`
* Run platform drift verification:
  `make check-platform-drift`
* Validate active config against schema:
  `make validate-config`
* Run secret scanning:
  `make gitleaks`

## Open Questions / Revisit Triggers
* **Dynamic Multi-Cluster Quotas**: If heterogeneous clusters require distinct size-to-quota maps (e.g., GPU clusters vs. edge clusters), reopen this decision to evaluate per-cluster config overlays.
* **Schema Upgrade to v2**: Reopen when deprecating adapters or changing quota data structures to implement automated migration scripts (`scripts/migrate-config.ts`).
