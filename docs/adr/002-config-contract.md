# ADR-002: Single Configuration File with JSON Schema Validation

## Status
Accepted

## Context
The system needs configuration for adapter selection, cluster settings, namespace naming, quotas, TTL, and approval thresholds. Secrets (API keys, tokens) are a separate concern.

## Decision
- **`devaiportal.config.yaml`** holds all non-secret configuration. It is validated against `devaiportal.config.schema.json` (JSON Schema draft-07 with `additionalProperties: false` at every level).
- **`.env`** holds secrets only. It is gitignored and documented in `.env.example`.
- Invalid config fails fast at startup with a human-readable message naming the exact JSON path of the error.
- `make setup` generates both files interactively.
- `make doctor` validates both files and performs live connectivity checks.

## Consequences
- Typos in config keys are caught immediately (additionalProperties: false).
- CI can validate config without credentials by checking schema conformance only.
- Secrets never leak into version control.
- The schema serves as machine-readable documentation of all config options.
