#!/bin/bash
set -euo pipefail

# Only run in remote/cloud sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] Installing dependencies..."
pnpm install

echo "[session-start] Building shared package..."
pnpm --filter @carbobo/shared build

echo "[session-start] Copying backend env..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
fi

echo "[session-start] Done."
