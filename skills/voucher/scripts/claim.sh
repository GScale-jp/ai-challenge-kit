#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' '使い方: claim.sh --passphrase 合言葉 --email 個人のGmail [--name 名前] [--test]' \
    '配布用URLは環境変数 AICK_VOUCHER_URL でも指定できます。'
}

passphrase=
email=
name=
endpoint=prod
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --test) endpoint=test; shift ;;
    --passphrase|--email|--name)
      if [ "$#" -lt 2 ]; then usage >&2; exit 1; fi
      case "$1" in
        --passphrase) passphrase=$2 ;;
        --email) email=$2 ;;
        --name) name=$2 ;;
      esac
      shift 2 ;;
    *) usage >&2; exit 1 ;;
  esac
done

if [ -z "$passphrase" ] || [ -z "$email" ]; then usage >&2; exit 1; fi
if [[ ! "$email" =~ ^[a-zA-Z0-9._%+-]+@[gG][mM][aA][iI][lL]\.[cC][oO][mM]$ ]]; then
  printf '%s\n' 'クレジットは個人の Gmail（@gmail.com）のみに適用できます。' >&2
  exit 2
fi
email=$(printf '%s' "$email" | LC_ALL=C tr 'A-Z' 'a-z')

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
json="$script_dir/claim-json.awk"
url=${AICK_VOUCHER_URL:-}
if [ -z "$url" ]; then
  url=$(LC_ALL=C awk -v mode=endpoint -v endpoint="$endpoint" -f "$json" \
    "${AICK_VOUCHER_CONFIG:-$script_dir/../config/endpoints.json}") || { printf '%s\n' "$url" >&2; exit 3; }
fi
case "$url" in
  ''|__*) printf '%s\n' '配布用URLがまだ設定されていません。' >&2; exit 3 ;;
esac

body=$(AICK_JSON_PASSPHRASE="$passphrase" AICK_JSON_EMAIL="$email" AICK_JSON_NAME="$name" \
  LC_ALL=C awk -v mode=request -f "$json" </dev/null)
if ! response=$(printf '%s' "$body" | curl -s -L \
    --proto '=http,https' --proto-redir '=http,https' --max-redirs 10 \
    --connect-timeout 15 --max-time 60 -H 'Content-Type: text/plain; charset=utf-8' \
    --data-binary @- -- "$url"); then
  printf '%s\n' '配布用APIに接続できませんでした。' >&2
  exit 4
fi

output=$(printf '%s\n' "$response" | LC_ALL=C awk -v mode=response -f "$json") || {
  printf '%s\n' "$output" >&2
  exit 1
}
printf '%s\n' "$output"
