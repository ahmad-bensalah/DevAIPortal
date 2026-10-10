# ADR-001: Hexagonal Architecture and Interchangeable Adapters for External Dependencies

* **Status**: Accepted
* **Date**: 2026-10-10
* **Deciders**: Platform Architecture Team, Senior SRE
* **Related ADRs**: [ADR-002](002-config-contract.md)

## Context
DevAIPortal connects to heterogeneous external systems: LLM foundation models, Git SCM hosts, notification mechanisms, identity providers, and credential backends. Enterprises deploy on different infrastructures: Azure (Azure OpenAI, GitHub, Teams, Entra ID), AWS/GCP (Anthropic, GitLab, Slack, OIDC), or self-hosted air-gapped clusters (Ollama, Gitea, Console, static-user). Hardcoding vendor-specific libraries inside core business workflows creates vendor lock-in, prevents local offline development, and makes automated testing dependent on external cloud APIs.

## Decision
We implement a strict Hexagonal / Adapter pattern using TypeScript interfaces and dynamic runtime dispatch:
1. **Core Domain Interfaces**: All third-party systems sit behind contracts:
   - [`LlmProvider`](../../agent/src/providers/llm-provider.ts): Structured output extraction and health diagnostics.
   - [`GitProvider`](../../adapters/git/src/git-provider.ts): Pull request generation and repository authorization.
   - [`Notifier`](../../adapters/notify/src/notifier.ts): Typed environment lifecycle event broadcasting.
   - [`IdentityMapper`](../../adapters/identity/src/identity-mapper.ts): Resolution of user identifiers to Kubernetes RBAC groups.
2. **Configuration-Driven Factory**: The active adapter for each domain is selected exclusively through `adapters.*` in [`devaiportal.config.yaml`](../../devaiportal.config.yaml). Core domain logic and n8n workflows consume generic interfaces (e.g. `llm.complete`, `git.open_pr`), never vendor SDKs.
3. **Mandatory Diagnostics**: Every adapter implements `healthCheck(): Promise<HealthResult>`, invoked by the preflight tool ([`scripts/doctor.sh`](../../scripts/doctor.sh)) to test live connectivity without executing business operations.
4. **Mandatory Contract Tests**: Every adapter must pass an identical test suite validating expected behaviors, error handling, and parameter boundaries before merge.

## Alternatives Considered

### Alternative 1: Direct Vendor SDK Integration Inside Business Logic
* **Description**: Import official SDKs (`@azure/openai`, `@octokit/rest`, `@slack/web-api`) directly where needed inside controllers and workflows.
* **Rejection Rationale**: Tightly couples the codebase to specific commercial cloud providers. Prevents air-gapped or zero-credential local evaluation (`make demo`), and requires mocks to replicate proprietary SDK quirks across every unit test.

### Alternative 2: Container-Level Microservices per Vendor
* **Description**: Deploy separate microservices (e.g., an LLM gateway service, a Git gateway service) communicating via gRPC or HTTP REST.
* **Rejection Rationale**: Excessive operational complexity and resource consumption for a lightweight developer portal. Increases cluster footprint and introduces network latency and distributed failure modes for simple API calls.

### Alternative 3: Plugin Architecture with Dynamic NPM Package Loading
* **Description**: Load third-party adapter plugins dynamically at runtime via `import(packageName)`.
* **Rejection Rationale**: Introduces supply-chain attack vectors, dependency version mismatch risks, and non-deterministic behavior in production environments. Shipping verified, in-tree adapters maintains strict quality and security standards.

## Consequences

### Positive
* **Zero-Credential Portability**: Developers and CI can run the entire platform locally using `mock`, `gitea`, `console`, and `static-user` adapters without any external cloud credentials.
* **Isolated Blast Radius**: Upgrading an external SDK or adapting to upstream API deprecations is strictly localized to a single adapter directory without risking core workflow logic.
* **Defensible SRE Operability**: The `make doctor` preflight can probe every integration independently with clear PASS/FAIL reporting.

### Negative
* **Lowest-Common-Denominator Constraint**: Adapters can only expose capabilities common to all underlying providers, potentially limiting provider-specific advanced features.
* **Maintenance Surface**: Every supported provider increases the testing matrix and ongoing dependency maintenance burden.

### Mitigations
* **For Feature Constraints**: Handled by passing structured generic payloads and leveraging provider-specific configuration blocks (e.g. `llm.*` in config) when necessary.
* **For Maintenance Surface**: Enforced through reusable contract test suites ([`agent/tests/llm-provider.contract.test.ts`](../../agent/tests/llm-provider.contract.test.ts), [`adapters/notify/tests/notifier.contract.test.ts`](../../adapters/notify/tests/notifier.contract.test.ts), [`adapters/identity/tests/identity-mapper.contract.test.ts`](../../adapters/identity/tests/identity-mapper.contract.test.ts)) that run identically against mock and production implementations.

## Verification
* Run adapter contract tests:
  `npx vitest run agent/tests/ adapters/`
* Verify adapter configuration via doctor preflight:
  `bash scripts/doctor.sh`

## Open Questions / Revisit Triggers
* **Asynchronous Streaming LLM Responses**: If user interfaces evolve to require real-time token streaming rather than single-turn JSON extraction, reopen this decision to extend `LlmProvider` with `AsyncIterable<string>`.
