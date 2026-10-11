# DevAIPortal — Makefile
# Entry points for all lifecycle operations.
# Run `make help` for available targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help

PROJECT_ROOT := $(shell pwd)
KIND_CLUSTER := devaiportal
KIND_CONFIG  := kind/kind-config.yaml
CONFIG_FILE  := devaiportal.config.yaml

# ──────────────────────────────────────────────────────────────
# Setup & Validation
# ──────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Interactive wizard — generates config and .env
	@bash scripts/setup.sh

.PHONY: doctor
doctor: ## Preflight checks — one real call per adapter
	@bash scripts/doctor.sh

.PHONY: validate-config
validate-config: ## Validate devaiportal.config.yaml against schema
	@npx --yes tsx scripts/validate-config.ts

.PHONY: deps
deps: ## Install Node.js dependencies
	npm ci

# ──────────────────────────────────────────────────────────────
# Build & Test
# ──────────────────────────────────────────────────────────────

.PHONY: build
build: ## Compile TypeScript
	npx tsc

.PHONY: test
test: ## Run all tests
	npx vitest run

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	npx vitest

.PHONY: lint-adrs
lint-adrs: ## Enforce Staff-Engineer standard on all Architecture Decision Records
	@npx --yes tsx scripts/lint-adrs.ts

.PHONY: gitleaks
gitleaks: ## Scan repository for secrets using gitleaks
	@if command -v gitleaks &>/dev/null; then \
		gitleaks detect --verbose --redact; \
	elif docker info &>/dev/null; then \
		docker run --rm -v "$$(pwd):/path" zricethezav/gitleaks:latest detect --source="/path" --verbose --redact; \
	else \
		echo "Notice: Neither gitleaks binary nor Docker daemon available for local secret scan."; \
		exit 0; \
	fi

.PHONY: render-platform
render-platform: ## Generate platform.yaml and Kyverno registry policy from config
	@npx --yes tsx scripts/render-platform.ts

.PHONY: check-platform-drift
check-platform-drift: ## Verify platform.yaml and Kyverno policies match config (CI)
	@npx --yes tsx scripts/render-platform.ts --check

# ──────────────────────────────────────────────────────────────
# Cluster Lifecycle
# ──────────────────────────────────────────────────────────────

.PHONY: cluster-create
cluster-create: ## Create kind cluster
	@if kind get clusters 2>/dev/null | grep -q "^$(KIND_CLUSTER)$$"; then \
		echo "Cluster $(KIND_CLUSTER) already exists"; \
	else \
		kind create cluster --name $(KIND_CLUSTER) --config $(KIND_CONFIG) --wait 60s; \
	fi

.PHONY: bootstrap
bootstrap: cluster-create ## Idempotent: install ArgoCD, Kyverno, n8n, import workflows
	@echo "Cluster context: kind-$(KIND_CLUSTER)"
	@echo "[PARTIAL] ArgoCD, Kyverno, and n8n helm installs are not yet automated."
	@echo "          See docs/operator-runbook.md for manual bootstrap steps."

.PHONY: demo
demo: ## Full demo: kind + bootstrap + sample request
	@echo "──── DevAIPortal Demo Mode ────"
	@if [ ! -f "$(CONFIG_FILE)" ]; then \
		echo "No config found. Copying demo defaults..."; \
		cp devaiportal.config.example.yaml $(CONFIG_FILE); \
	fi
	@$(MAKE) cluster-create
	@$(MAKE) doctor || true
	@echo ""
	@echo "Demo cluster ready. Context: kind-$(KIND_CLUSTER)"
	@echo "[PARTIAL] Bootstrap and sample request are not yet automated."
	@echo "          Run individual Makefile targets or follow docs/demo.md."

.PHONY: teardown
teardown: ## Delete kind cluster and clean up
	kind delete cluster --name $(KIND_CLUSTER) 2>/dev/null || true
	@echo "Cluster deleted."

# ──────────────────────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
