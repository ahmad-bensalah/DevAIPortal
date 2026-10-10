# Assumptions

Decisions made without explicit user input. Each is the most conservative or portable choice available. If any assumption is wrong, the fix is localized to the component noted.

## Runtime

- **Node.js >= 20** is the runtime for the agent library and adapter code. Chosen because n8n is Node-based and it avoids a second runtime. (Component: `package.json`, `tsconfig.json`)
- **Bash scripts** are POSIX-ish and target `bash >= 4`. macOS users may need `brew install bash`. (Component: `scripts/`)

## Configuration

- **YAML is the config format** over TOML/JSON because it is the Kubernetes ecosystem lingua franca. (Component: `config/`)
- **JSON Schema draft-07** for validation, matching Helm's `values.schema.json`. (Component: `devaiportal.config.schema.json`)
- **Secrets never appear in config YAML** — they live in `.env` only, loaded via `dotenv`. (Component: `config/`, `scripts/`)

## Adapters

- **Mock LLM uses keyword extraction**, not a real model. It covers the happy path for demo and CI but will not handle ambiguous or adversarial inputs. Real LLM adapters are needed for production. (Component: `agent/src/providers/mock-llm.ts`)
- **Static user mapper assigns every user to `devaiportal-users` plus `team-<username>`**. This is sufficient for single-user demo but not for multi-tenant production. (Component: `adapters/identity/`)
- **Console notifier writes to stdout**. It does not format rich messages. Teams/Slack/Email adapters will use adaptive cards / block kit / HTML respectively. (Component: `adapters/notify/`)

## Cluster

- **Kind is the demo cluster** with port mappings on 80/443/5678/3000. These ports must be free on the host. (Component: `kind/kind-config.yaml`)
- **Ingress class defaults to `nginx`**. The kind bootstrap will install ingress-nginx. (Component: `devaiportal.config.example.yaml`)
- **No TLS in demo mode** — `clusterIssuer` is omitted. Production deployments should set it. (Component: config)

## Git

- **Gitea is the demo Git host**, running inside the kind cluster. GitHub/GitLab adapters are for production. (Component: `adapters/git/`)
- **Git repo is `devaiportal/devaiportal`** by default. The setup wizard allows customization. (Component: config)

## Naming

- **`devaiportal.io/` annotation prefix** is used consistently. This is not a registered domain; it is a conventional prefix. (Component: all Kubernetes manifests)
- **Namespace pattern `<prefix>-<name>`** with `env` as default prefix. (Component: config, chart)

## TTL

- **Default 3 days, max 14 days** for demo. Production operators should adjust in config. (Component: config)
- **Approval required for TTL > 7 days or size > medium** in demo defaults. (Component: config)

## Versions (pinned)

- TypeScript 5.6.3, Vitest 2.1.4, Ajv 8.17.1, Zod 3.23.8
- These are current stable as of the project start date. Dependabot or Renovate should manage updates.
