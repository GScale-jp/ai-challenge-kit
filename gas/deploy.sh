#!/bin/bash
# 使い方: gas/deploy.sh test|prod
# clasp.<env>.json（scriptId を控えたもの）を .clasp.json に切り替えて push し、Web アプリとして再デプロイする。
# 初回に deployment を作ったら、その deploymentId を gas/clasp.<env>.json の "deploymentId" に控える（clasp は無視する）。
set -euo pipefail
ENV="${1:-}"
case "$ENV" in test|prod) ;; *) echo "usage: $0 test|prod" >&2; exit 2;; esac
cd "$(dirname "$0")"
[ -f "clasp.$ENV.json" ] || { echo "clasp.$ENV.json がありません（scriptId を控える）" >&2; exit 1; }
node --test test/*.test.js >/dev/null || { echo "テストが通らないので中止" >&2; exit 1; }
cp "env/$ENV.js" src/env.js
cp "clasp.$ENV.json" .clasp.json
clasp push --force </dev/null
DEP=$(python3 -c "import json;print(json.load(open('clasp.$ENV.json')).get('deploymentId',''))")
if [ -n "$DEP" ]; then
  clasp redeploy "$DEP" -d "deploy $(date +%Y%m%d-%H%M%S)"
else
  clasp deploy -d "initial $ENV"
  echo "↑ 出た deploymentId を clasp.$ENV.json に \"deploymentId\" として追記し、endpoints.json に /exec URL を書く" >&2
fi
rm -f .clasp.json src/env.js
