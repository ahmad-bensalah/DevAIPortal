# Architecture Decision Records (ADRs)

This directory documents the foundational architecture and engineering trade-offs of **DevAIPortal**. We treat ADRs as immutable historical records.

## Decision Register

| Number | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| [ADR-001](001-adapter-pattern.md) | Hexagonal Architecture and Interchangeable Adapters for External Dependencies | Accepted | 2026-10-10 |
| [ADR-002](002-config-contract.md) | Single Source of Truth Configuration Contract with JSON Schema and Generated Platform Governance | Accepted | 2026-10-10 |

---

## How We Write ADRs

Every decision record must satisfy the criteria defined in [`template.md`](template.md) and is enforced in CI via `make lint-adrs` (`scripts/lint-adrs.ts`):

1. **Title**: Action-oriented statement (`ADR-NNN: <Short statement>`).
2. **Metadata**: Status, Date (`YYYY-MM-DD`), Deciders, and Related ADR links.
3. **Context**: Technical context, operational constraints, and forces in tension (5-10 lines).
4. **Decision**: Active voice, testable specifications.
5. **Alternatives Considered**: At least 3 genuine, defensible engineering alternatives with concrete rejection rationale (no strawmen).
6. **Consequences**: Explicitly split into **Positive**, **Negative** (at least 2 real risks/costs), and **Mitigations** linking directly to tests, scripts, or CI workflows.
7. **Verification**: Exact terminal commands or CI jobs proving the decision holds.
8. **Open Questions / Revisit Triggers**: Objective triggers to reopen the decision.

### Immutability & Superseding
Never modify an accepted ADR's decision in place. When requirements shift or architecture evolves:
1. Create a new ADR (`ADR-NNN`).
2. Update the previous ADR's status to `Superseded by ADR-NNN`.
3. Reference both in the Decision Register above.
