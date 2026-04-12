#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun is available in PATH for all zellij panes
export PATH="$HOME/.bun/bin:$PATH"

echo "Starting UserCore infrastructure..."
docker compose -f "$SCRIPT_DIR/infra/docker-compose.yml" up -d

echo "Waiting for services to be healthy..."
sleep 3

echo "Launching Zellij..."
cd "$ROOT_DIR"
zellij --layout "$SCRIPT_DIR/usercore.zellij.kdl"
