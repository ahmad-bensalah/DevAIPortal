# ADR-NNN: [Decision Title as a Short, Actionable Statement]

* **Status**: [Proposed | Accepted | Superseded by ADR-XXX]
* **Date**: [YYYY-MM-DD]
* **Deciders**: [Name/Role, ...]
* **Related ADRs**: [ADR-001](001-adapter-pattern.md), [...]

## Context
[5-10 lines stating the exact operational problem, the system constraints, who edits/consumes it, target environments, portability requirements, and security boundaries. Name the engineering forces in tension.]

## Decision
[State what we do in the active voice. Be specific, measurable, and testable. Name exact file paths, schemas, tools, and interfaces.]

## Alternatives Considered

### Alternative 1: [Name]
* **Description**: [How this option works]
* **Rejection Rationale**: [Concrete technical or operational failure reason why this option was discarded]

### Alternative 2: [Name]
* **Description**: [How this option works]
* **Rejection Rationale**: [Concrete technical or operational failure reason why this option was discarded]

### Alternative 3: [Name]
* **Description**: [How this option works]
* **Rejection Rationale**: [Concrete technical or operational failure reason why this option was discarded]

## Consequences

### Positive
* [Direct benefit 1]
* [Direct benefit 2]

### Negative
* [Risk or operational overhead 1]
* [Risk or operational overhead 2]

### Mitigations
* **For [Negative 1]**: [Mitigating control, with link to test, script, or CI workflow]
* **For [Negative 2]**: [Mitigating control, with link to test, script, or CI workflow]

## Verification
[Exact commands and test suites that prove this decision holds in practice]
* `make test`
* `npx vitest run ...`

## Open Questions / Revisit Triggers
* [Condition under which this decision should be re-evaluated, e.g. scale threshold, deprecation, or new upstream feature]
