# Contributing to DevAIPortal

Thank you for considering a contribution. This guide establishes the standards for keeping the repository at a staff-engineer quality level — every contribution must be verifiable, honest, and traceable.

---

## Standards Before Opening a PR

1. **Tests must pass.** Run `make test` locally. Every new feature or bug fix requires a corresponding test.
2. **TypeScript must compile.** Run `npx tsc --noEmit` and verify zero errors.
3. **No secrets.** Run `make gitleaks` before pushing. Never commit credentials, tokens, or `.env` files.
4. **ADRs for architectural decisions.** If your change introduces a new pattern or overrides a current decision, write an ADR in `docs/adr/` following the template at `docs/adr/template.md`. The linter at `scripts/lint-adrs.ts` will enforce the 8-section standard.
5. **Platform drift check.** If you modify `devaiportal.config.yaml`, run `make render-platform` and commit the updated generated files (`charts/environment/files/platform.yaml`, `policies/registry-allowlist.yaml`).

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

| Type | When to Use |
| :--- | :--- |
| `feat` | New capability (adapter, chart template, workflow) |
| `fix` | Bug fix in existing behaviour |
| `test` | New or updated tests only |
| `docs` | Documentation changes |
| `ci` | Changes to CI/CD pipeline |
| `refactor` | Code change that neither adds features nor fixes bugs |
| `chore` | Dependency updates, tooling, gitignore |

**No merge commits.** Rebase your branch onto `main` before opening a PR.

---

## Adding a New Adapter

1. Implement the relevant interface in `adapters/<domain>/src/`:
   - `LlmProvider` (`agent/src/providers/llm-provider.ts`)
   - `Notifier` (`adapters/notify/src/notifier.ts`)
   - `IdentityMapper` (`adapters/identity/src/identity-mapper.ts`)
   - `GitProvider` (`adapters/git/src/git-provider.ts`)
2. Add contract tests in the corresponding `tests/` directory using the existing contract helper pattern.
3. Add the adapter to `make doctor` health check in `scripts/doctor.sh`.
4. Document required credentials in `docs/credentials.md` with minimum IAM scopes.

---

## Adding a Helm Blueprint

1. Add a new template file in `charts/environment/templates/`.
2. Add corresponding fixtures in `charts/environment/fixtures/valid/` and `charts/environment/fixtures/invalid/`.
3. Add a golden snapshot: `helm template test charts/environment -f fixtures/valid/<new>.yaml > snapshots/<new>.golden.yaml`.
4. Add tests in `charts/environment/chart.test.ts` covering render success and schema rejection cases.

---

## Development Environment Setup

```bash
# 1. Install Node.js 20 (via nvm)
nvm install 20 && nvm use 20

# 2. Install project dependencies
npm ci

# 3. Install kind (for cluster testing)
# https://kind.sigs.k8s.io/docs/user/quick-start/

# 4. Copy and configure environment
cp .env.example .env && $EDITOR .env

# 5. Verify environment
make doctor

# 6. Run tests
make test
```
