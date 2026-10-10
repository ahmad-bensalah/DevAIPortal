#!/usr/bin/env bash
# DevAIPortal — Preflight Doctor
# Performs one real call per configured adapter and validates prerequisites.
# Usage: make doctor
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/devaiportal.config.yaml"
ENV_FILE="$PROJECT_ROOT/.env"

# Load .env if present
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}PASS${NC} $*"; ((PASS++)); }
fail() { echo -e "  ${RED}FAIL${NC} $*"; ((FAIL++)); }
skip() { echo -e "  ${YELLOW}SKIP${NC} $*"; ((WARN++)); }

# ─── Parse config with yq or python ──────────────────────────
get_config() {
  local key="$1"
  if command -v yq &>/dev/null; then
    yq -r "$key" "$CONFIG_FILE" 2>/dev/null
  elif command -v python3 &>/dev/null; then
    python3 -c "
import yaml, sys
with open('$CONFIG_FILE') as f:
    c = yaml.safe_load(f)
keys = '$key'.lstrip('.').split('.')
v = c
for k in keys:
    v = v[k]
print(v)
" 2>/dev/null
  else
    echo ""
  fi
}

echo -e "\n${BOLD}DevAIPortal — Preflight Check${NC}\n"

# ─── 1. Prerequisites ────────────────────────────────────────
echo -e "${CYAN}Prerequisites${NC}"

for tool in docker kubectl helm kind make; do
  if command -v "$tool" &>/dev/null; then
    ver=$("$tool" version --short 2>/dev/null || "$tool" --version 2>/dev/null | head -1 || echo "installed")
    pass "$tool — $ver"
  else
    fail "$tool not found. Install it: https://kubernetes.io/docs/tasks/tools/"
  fi
done

# Node.js
if command -v node &>/dev/null; then
  node_ver=$(node --version)
  major=$(echo "$node_ver" | sed 's/v//' | cut -d. -f1)
  if (( major >= 20 )); then
    pass "node $node_ver"
  else
    fail "node $node_ver — requires >= v20. Install via nvm or .tool-versions."
  fi
else
  fail "node not found. Install Node.js >= 20."
fi

# ─── 2. Config file ──────────────────────────────────────────
echo -e "\n${CYAN}Configuration${NC}"

if [[ -f "$CONFIG_FILE" ]]; then
  pass "Config file exists: $CONFIG_FILE"
else
  fail "Config file missing. Run: make setup"
fi

if [[ -f "$ENV_FILE" ]]; then
  pass ".env file exists"
else
  skip ".env file missing — only needed if using non-mock adapters."
fi

# Validate config against schema
if [[ -f "$CONFIG_FILE" ]]; then
  if npx --yes tsx "$PROJECT_ROOT/scripts/validate-config.ts" &>/dev/null; then
    pass "Config schema validation"
  else
    fail "Config schema validation — run: npx tsx scripts/validate-config.ts"
  fi
fi

# ─── 3. Adapters ─────────────────────────────────────────────
echo -e "\n${CYAN}Adapters${NC}"

LLM_ADAPTER=$(get_config ".adapters.llm" 2>/dev/null || echo "unknown")
GIT_ADAPTER=$(get_config ".adapters.git" 2>/dev/null || echo "unknown")
NOTIFY_ADAPTER=$(get_config ".adapters.notifier" 2>/dev/null || echo "unknown")
IDENTITY_ADAPTER=$(get_config ".adapters.identity" 2>/dev/null || echo "unknown")

# LLM check
case "$LLM_ADAPTER" in
  mock)
    pass "LLM adapter: mock (no credentials needed)"
    ;;
  openai)
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
      if curl -sf -H "Authorization: Bearer $OPENAI_API_KEY" \
        "https://api.openai.com/v1/models" -o /dev/null 2>/dev/null; then
        pass "LLM adapter: openai — API key valid"
      else
        fail "LLM adapter: openai — API key rejected. Check OPENAI_API_KEY in .env"
      fi
    else
      fail "LLM adapter: openai — OPENAI_API_KEY not set in .env"
    fi
    ;;
  azure-openai)
    if [[ -n "${AZURE_OPENAI_API_KEY:-}" && -n "${AZURE_OPENAI_ENDPOINT:-}" ]]; then
      if curl -sf -H "api-key: $AZURE_OPENAI_API_KEY" \
        "${AZURE_OPENAI_ENDPOINT}/openai/models?api-version=2024-02-15-preview" -o /dev/null 2>/dev/null; then
        pass "LLM adapter: azure-openai — endpoint reachable"
      else
        fail "LLM adapter: azure-openai — endpoint unreachable. Check AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY."
      fi
    else
      fail "LLM adapter: azure-openai — AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT not set."
    fi
    ;;
  anthropic)
    if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
      pass "LLM adapter: anthropic — key present (live check deferred to test suite)"
    else
      fail "LLM adapter: anthropic — ANTHROPIC_API_KEY not set in .env"
    fi
    ;;
  ollama)
    OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
    if curl -sf "$OLLAMA_URL/api/tags" -o /dev/null 2>/dev/null; then
      pass "LLM adapter: ollama — server reachable at $OLLAMA_URL"
    else
      fail "LLM adapter: ollama — server unreachable at $OLLAMA_URL. Start with: ollama serve"
    fi
    ;;
  *)
    fail "LLM adapter: unknown value '$LLM_ADAPTER'"
    ;;
esac

# Git check
case "$GIT_ADAPTER" in
  gitea)
    GIT_URL=$(get_config ".git.url" 2>/dev/null || echo "http://localhost:3000")
    if curl -sf "$GIT_URL/api/v1/version" -o /dev/null 2>/dev/null; then
      pass "Git adapter: gitea — server reachable at $GIT_URL"
    else
      skip "Git adapter: gitea — server not running at $GIT_URL (expected for pre-bootstrap)"
    fi
    ;;
  github)
    if [[ -n "${GIT_TOKEN:-}" ]]; then
      if curl -sf -H "Authorization: token $GIT_TOKEN" \
        "https://api.github.com/user" -o /dev/null 2>/dev/null; then
        pass "Git adapter: github — token valid"
      else
        fail "Git adapter: github — token rejected. Check GIT_TOKEN in .env (needs repo scope)"
      fi
    else
      fail "Git adapter: github — GIT_TOKEN not set in .env"
    fi
    ;;
  gitlab)
    if [[ -n "${GIT_TOKEN:-}" ]]; then
      GIT_URL=$(get_config ".git.url" 2>/dev/null || echo "https://gitlab.com")
      if curl -sf -H "PRIVATE-TOKEN: $GIT_TOKEN" \
        "$GIT_URL/api/v4/user" -o /dev/null 2>/dev/null; then
        pass "Git adapter: gitlab — token valid"
      else
        fail "Git adapter: gitlab — token rejected. Check GIT_TOKEN in .env (needs api scope)"
      fi
    else
      fail "Git adapter: gitlab — GIT_TOKEN not set in .env"
    fi
    ;;
esac

# Notifier check
case "$NOTIFY_ADAPTER" in
  console)
    pass "Notifier: console (no credentials needed)"
    ;;
  slack)
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
      pass "Notifier: slack — webhook URL configured"
    else
      fail "Notifier: slack — SLACK_WEBHOOK_URL not set in .env"
    fi
    ;;
  teams)
    if [[ -n "${TEAMS_WEBHOOK_URL:-}" ]]; then
      pass "Notifier: teams — webhook URL configured"
    else
      fail "Notifier: teams — TEAMS_WEBHOOK_URL not set in .env"
    fi
    ;;
  email)
    if [[ -n "${SMTP_HOST:-}" && -n "${SMTP_PASS:-}" ]]; then
      pass "Notifier: email — SMTP credentials configured"
    else
      fail "Notifier: email — SMTP_HOST or SMTP_PASS not set in .env"
    fi
    ;;
esac

# Identity check
case "$IDENTITY_ADAPTER" in
  static-user)
    pass "Identity: static-user (no credentials needed)"
    ;;
  entra-group)
    if [[ -n "${ENTRA_TENANT_ID:-}" && -n "${ENTRA_CLIENT_ID:-}" && -n "${ENTRA_CLIENT_SECRET:-}" ]]; then
      pass "Identity: entra-group — credentials configured"
    else
      fail "Identity: entra-group — ENTRA_TENANT_ID, ENTRA_CLIENT_ID, or ENTRA_CLIENT_SECRET missing"
    fi
    ;;
  oidc-group)
    if [[ -n "${OIDC_ISSUER_URL:-}" ]]; then
      pass "Identity: oidc-group — issuer configured"
    else
      fail "Identity: oidc-group — OIDC_ISSUER_URL not set in .env"
    fi
    ;;
esac

# ─── 4. Kubernetes ───────────────────────────────────────────
echo -e "\n${CYAN}Kubernetes${NC}"

CLUSTER_CTX=$(get_config ".cluster.context" 2>/dev/null || echo "kind-devaiportal")

if kubectl cluster-info --context "$CLUSTER_CTX" &>/dev/null; then
  pass "Cluster reachable: $CLUSTER_CTX"

  # ArgoCD
  if kubectl get namespace argocd --context "$CLUSTER_CTX" &>/dev/null; then
    pass "ArgoCD namespace exists"
  else
    skip "ArgoCD not installed — run: make bootstrap"
  fi

  # Kyverno
  if kubectl get namespace kyverno --context "$CLUSTER_CTX" &>/dev/null; then
    pass "Kyverno namespace exists"
  else
    skip "Kyverno not installed — run: make bootstrap"
  fi

  # n8n
  if kubectl get namespace n8n --context "$CLUSTER_CTX" &>/dev/null; then
    pass "n8n namespace exists"
  else
    skip "n8n not installed — run: make bootstrap"
  fi
else
  skip "Cluster not reachable: $CLUSTER_CTX (expected before make bootstrap)"
fi

# ─── Summary ─────────────────────────────────────────────────
echo -e "\n${BOLD}Summary${NC}"
echo -e "  ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN skipped${NC}"

if (( FAIL > 0 )); then
  echo -e "\n${RED}Some checks failed. Fix the issues above before proceeding.${NC}"
  exit 1
else
  echo -e "\n${GREEN}All critical checks passed.${NC}"
  exit 0
fi
