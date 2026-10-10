# Security Policy

## Supported Versions

This project is currently in pre-release. Only the latest revision on the `main` branch is supported.

| Branch | Supported |
| :--- | :--- |
| `main` | Yes |
| Feature branches | No |

---

## Reporting a Vulnerability

**Do not open a public GitHub Issue for security vulnerabilities.**

Report security issues via GitHub's private security advisory mechanism:

1. Navigate to the repository **Security** tab.
2. Click **Report a vulnerability**.
3. Provide a clear description, reproduction steps, and the impact you believe applies.

You should receive an acknowledgement within 48 hours. If the vulnerability is confirmed, a fix will be prepared and coordinated before any public disclosure.

---

## Security Architecture Summary

DevAIPortal is designed with a layered defense model. The key invariants are:

1. **LLM never touches the cluster API.** The agent only outputs JSON; it has no kubeconfig or API credentials.
2. **All cluster state change flows through Git.** Every provisioning action creates a pull request that must pass CI schema validation before merge.
3. **Admission-time enforcement.** Kyverno policies (registry allowlist, latest-tag disallow, PSA restricted, TTL cleanup) enforce guarantees independent of the request pipeline.
4. **No credentials in repository.** The `.env` file is gitignored. Gitleaks scans run on every push via CI.

For a full STRIDE threat analysis, see [docs/threat-model.md](docs/threat-model.md).  
For minimum required IAM scopes, see [docs/credentials.md](docs/credentials.md).
