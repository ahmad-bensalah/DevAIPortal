#!/usr/bin/env bash
# DevPortal IA — Validate config against JSON Schema
# Called by CI and `make validate-config`
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

exec node --import tsx "$PROJECT_ROOT/scripts/validate-config.ts" "$@"
