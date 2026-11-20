#!/usr/bin/env bash
set -euo pipefail

if ! curl -fsSL https://antigravity.google/cli/install.sh | bash; then
  printf '%s\n' '::notice::agy の公式インストーラが失敗したため、厳格検証をスキップします。'
  exit 0
fi
export PATH="$HOME/.local/bin:$HOME/.antigravity/bin:$PATH"
if ! command -v agy >/dev/null 2>&1; then
  printf '%s\n' '::notice::インストール後も agy が見つからないため、厳格検証をスキップします。'
  exit 0
fi
if [ -n "${GITHUB_PATH:-}" ]; then
  printf '%s\n' "$HOME/.local/bin" "$HOME/.antigravity/bin" >> "$GITHUB_PATH"
fi

status=0
report=$(env -u AGY_ADC_AUTH agy plugin validate . --strict 2>&1) || status=$?
printf '%s\n' "$report"
if [ "$status" = 0 ]; then exit 0; fi
if [ "$status" = 126 ] || [ "$status" = 127 ] ||
  printf '%s\n' "$report" | grep -Eiq 'log[ -]?in|sign[ -]?in|authenticat|認証|ログイン|permission denied|cannot execute|exec format error|bad cpu type|dyld'; then
  printf '%s\n' '::notice::agy の認証または起動に失敗したため、厳格検証をスキップします。'
  exit 0
fi
exit "$status"
