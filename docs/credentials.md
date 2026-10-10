# Credentials & Identity Reference Guide

This document describes all credentials consumed by **DevAIPortal**, where to obtain them, and the **strictly minimal required permission scopes** (Least Privilege principle).

---

## 1. LLM Providers

### Azure OpenAI (`adapters.llm: azure-openai`)
* **Portal Location**: Azure Portal ➔ Azure OpenAI ➔ Keys and Endpoint.
* **Environment Variables**:
  * `AZURE_OPENAI_API_KEY`: API Key 1 or Key 2.
  * `AZURE_OPENAI_ENDPOINT`: Target endpoint URL (`https://<resource>.openai.azure.com/`).
  * `AZURE_OPENAI_DEPLOYMENT`: Model deployment name (e.g. `gpt-4o`).
* **Minimum RBAC Role**:
  * `Cognitive Services OpenAI User` (ID: `5e0703e6-3fa5-4321-a69c-1422e607004b`) assigned at the cognitive services account resource scope.
  * *Never* assign `Cognitive Services Contributor` or `Owner`.

### OpenAI (`adapters.llm: openai`)
* **Portal Location**: [platform.openai.com](https://platform.openai.com/api-keys)
* **Environment Variable**: `OPENAI_API_KEY` (`sk-...`)
* **Minimum Scope**:
  * Restricted API key with `Model Capabilities: Write` on chat completions.

### Anthropic (`adapters.llm: anthropic`)
* **Portal Location**: [console.anthropic.com](https://console.anthropic.com/settings/keys)
* **Environment Variable**: `ANTHROPIC_API_KEY` (`sk-ant-...`)

### Ollama (`adapters.llm: ollama`)
* **Location**: Local daemon running at `http://localhost:11434`
* **Credentials**: None required (air-gapped local execution).

---

## 2. Git Providers

### GitHub (`adapters.git: github`)
* **Portal Location**: GitHub Settings ➔ Developer Settings ➔ Personal Access Tokens (Fine-grained).
* **Environment Variable**: `GIT_TOKEN`
* **Minimum Permissions**:
  * Repository: Selected repository only (`enterprise-org/devaiportal-gitops`).
  * Permissions:
    * `Contents`: Read and write (to branch and commit values files).
    * `Pull requests`: Read and write (to open GitOps PRs).
    * `Metadata`: Read-only.

### GitLab (`adapters.git: gitlab`)
* **Portal Location**: User Settings ➔ Access Tokens / Project Access Tokens.
* **Minimum Scope**: `api` (or `write_repository`).

### Gitea (`adapters.git: gitea`)
* **Portal Location**: Gitea User Settings ➔ Applications.
* **Minimum Scope**: `repo:write`, `issue:write`.

---

## 3. Notifiers

### Microsoft Teams (`adapters.notifier: teams`)
* **Portal Location**: Teams Channel ➔ Connectors / Workflows ➔ "Post to a channel when a webhook request is received".
* **Environment Variable**: `TEAMS_WEBHOOK_URL`
* **Scopes**: Channel-specific inbound webhook.

### Slack (`adapters.notifier: slack`)
* **Portal Location**: [api.slack.com/apps](https://api.slack.com/apps) ➔ Incoming Webhooks.
* **Environment Variable**: `SLACK_WEBHOOK_URL`
* **Minimum Scope**: `incoming-webhook` restricted to designated alerts channel.

---

## 4. Identity & RBAC Providers

### Microsoft Entra ID (`adapters.identity: entra-group`)
* **Portal Location**: Azure Portal ➔ Microsoft Entra ID ➔ App registrations.
* **Environment Variables**:
  * `ENTRA_TENANT_ID`: Directory (tenant) ID.
  * `ENTRA_CLIENT_ID`: Application (client) ID.
  * `ENTRA_CLIENT_SECRET`: Client secret value.
* **Minimum Microsoft Graph Application Permission**:
  * `GroupMember.Read.All` (Application permission with Admin Consent).
  * *Never* grant `Directory.ReadWrite.All` or User Administrator roles.

---

## 5. Secret Storage Paths

1. **Local Development**: `.env` (strictly ignored by `.gitignore` and audited by Gitleaks).
2. **Kubernetes Cluster**: Namespaced Kubernetes `Secret` injected into orchestrator pods.
3. **Enterprise Production**: **External Secrets Operator (ESO)** synchronizing directly from Azure Key Vault or HashiCorp Vault.
