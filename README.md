# DevAIPortal

Conversational self-service portal for ephemeral Kubernetes environments. A developer asks in natural language for an environment; an LLM agent extracts validated parameters; Helm renders manifests; a Git PR carries the change; ArgoCD deploys it; Kyverno enforces policy and cleans up.

**Core principle: the AI proposes, Git and policies decide.**

## Prerequisites

- Docker
- kubectl
- Helm >= 3.16
- kind >= 0.24
- make
- Node.js >= 20

## Quickstart

```bash
# 1. Clone
git clone <repo-url> && cd devaiportal

# 2. Install dependencies
make deps

# 3. Interactive setup (generates config and .env)
make setup

# 4. Verify everything
make doctor

# 5. Bootstrap cluster with ArgoCD, Kyverno, n8n
make bootstrap

# 6. Or run the full demo (kind cluster + everything)
make demo
```

## Demo Mode (zero credentials)

```bash
make demo
```

This creates a kind cluster, installs all components with mock/local adapters, and submits a sample request. No API keys or external services required.

## Configuration

- `devaiportal.config.yaml` — non-secret choices (adapter selection, cluster, quotas, TTL)
- `.env` — secrets only (API keys, tokens, webhooks)
- `devaiportal.config.schema.json` — JSON Schema for config validation

See `.env.example` for all variables with documentation on where to obtain each credential and its minimum required scopes.

## Architecture

```
Developer → Chat/Web → n8n (orchestrator)
                         ├─ LLM Agent → structured parameters
                         ├─ Git PR → environments/<name>/values.yaml
                         ├─ Notifier → Teams/Slack/Email/Console
                         └─ Identity → RBAC group resolution

ArgoCD (ApplicationSet) ← watches Git → Kubernetes
Kyverno ← enforces policy, cleans up expired namespaces
```

## Adapter Pattern

Every external dependency is behind an interface. Swap providers by changing one config key:

| Concern   | Config Key           | Options                                      |
|-----------|---------------------|-----------------------------------------------|
| LLM       | `adapters.llm`      | `mock`, `openai`, `azure-openai`, `anthropic`, `ollama` |
| Git       | `adapters.git`      | `gitea`, `github`, `gitlab`                   |
| Notifier  | `adapters.notifier` | `console`, `slack`, `teams`, `email`          |
| Identity  | `adapters.identity` | `static-user`, `entra-group`, `oidc-group`    |
| Secrets   | `adapters.secrets`  | `env`, `kubernetes`, `external-secrets`       |

## Make Targets

```
make setup           Interactive wizard — generates config and .env
make doctor          Preflight checks — one real call per adapter
make deps            Install Node.js dependencies
make test            Run all tests
make bootstrap       Install ArgoCD, Kyverno, n8n on cluster
make demo            Full demo: kind + bootstrap + sample request
make teardown        Delete kind cluster
make help            Show all targets
```

## Documentation

- `docs/assumptions.md` — decisions made without explicit input
- `docs/adr/` — architectural decision records
- `docs/credentials.md` — how to obtain each credential with minimum scopes
- `docs/operator-runbook.md` — operations guide

## License

Internal platform — see your organization's licensing policy.
