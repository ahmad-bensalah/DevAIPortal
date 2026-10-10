# ADR-001: Adapter Pattern for External Dependencies

## Status
Accepted

## Context
DevAIPortal integrates with multiple external systems: LLM providers, Git hosts, notification channels, identity providers, and secret stores. Each has multiple vendor implementations. The system must be portable across vendors with zero code changes outside configuration.

## Decision
Every external dependency sits behind a TypeScript interface. Concrete implementations (adapters) are selected by a single config key. Business logic never imports a vendor-specific module directly.

Interfaces:
- `LlmProvider` — structured output from natural language
- `GitProvider` — pull request creation
- `Notifier` — lifecycle event notifications
- `IdentityMapper` — user-to-RBAC-group resolution
- `SecretSource` — credential retrieval

Each interface defines:
1. A `name` property for logging and diagnostics
2. A `healthCheck()` method for the doctor preflight
3. One or more domain-specific methods

Adapter selection happens in `devaiportal.config.yaml` under `adapters.*`. A factory function reads the config and instantiates the correct adapter.

## Consequences
- Adding a new vendor requires only a new adapter file and a new enum value in the config schema.
- Every adapter has a contract test suite that can be run against any implementation.
- The mock/console/static adapters enable a fully offline demo with zero credentials.
- n8n workflows use generic sub-workflow names (`llm.complete`, `git.open_pr`), never vendor names.
