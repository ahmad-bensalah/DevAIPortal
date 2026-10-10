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

.PHONY: render-platform
render-platform: ## Generate charts/environment/files/platform.yaml from config
	@echo "TODO: implement in step 1"

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
	@echo "TODO: implement in steps 2-5"
	@echo "Cluster context: kind-$(KIND_CLUSTER)"

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
	@echo "TODO: bootstrap + sample request (steps 2-5)"

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
