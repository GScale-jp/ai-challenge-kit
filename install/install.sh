#!/usr/bin/env bash
set -euo pipefail

plugin=ai-challenge-kit
remote=https://github.com/GScale-jp/ai-challenge-kit
zip_url=https://codeload.github.com/GScale-jp/ai-challenge-kit/zip/refs/heads/main
yes=${AICK_YES:-0}
uninstall=0
for arg in "$@"; do
  case "$arg" in
    --yes) yes=1 ;;
    --uninstall) uninstall=1 ;;
    --help|-h) printf '%s\n' '使い方: bash install.sh [--yes] [--uninstall]'; exit 0 ;;
    *) printf '不明なオプションです: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

find_agy() {
  local candidate
  for candidate in "${AGY_BIN:-}" agy "$HOME/.local/bin/agy" "$HOME/.antigravity/bin/agy"; do
    [ -n "$candidate" ] || continue
    if command -v "$candidate" >/dev/null 2>&1 && { [[ "$candidate" != */* ]] || [ -x "$candidate" ]; }; then
      command -v "$candidate"
      return
    fi
  done
  return 1
}

confirm_install() {
  printf '%s' '公式インストーラで agy を入れますか？ [y/N] ' >&3
  IFS= read -r answer <&3
}

if ! agy_bin=$(find_agy); then
  if [ "$uninstall" = 1 ]; then
    printf '%s\n' 'agy が見つかりません。' >&2
    exit 1
  fi
  if [ "$yes" != 1 ]; then
    if ! confirm_install 2>/dev/null 3<>/dev/tty; then
      printf '%s\n' '端末がない環境では --yes または AICK_YES=1 を指定してください。' >&2
      exit 1
    fi
    case "$answer" in y|Y|yes|YES|Yes) ;; *) printf '%s\n' 'インストールを中止しました。'; exit 1 ;; esac
  fi
  printf '%s\n' 'agy をインストールします。'
  if [ -n "${AICK_AGY_INSTALLER_CMD:-}" ]; then
    bash -o pipefail -c "$AICK_AGY_INSTALLER_CMD"
  else
    curl -fsSL https://antigravity.google/cli/install.sh | bash
  fi
  hash -r
  if ! agy_bin=$(find_agy); then
    printf '%s\n' '公式インストーラの実行後も agy が見つかりません。' >&2
    exit 1
  fi
fi

if [ "$uninstall" = 1 ]; then
  "$agy_bin" plugin uninstall "$plugin"
  printf '%s は削除せず、そのまま残しました。\n' "${AICK_HOME:-$HOME/ai-challenge}"
  exit 0
fi

source=${AICK_SOURCE:-$remote}
replaced=0
if listed=$("$agy_bin" plugin list 2>&1) && [[ "$listed" == *"$plugin"* ]]; then
  printf '%s\n' 'インストール済みのプラグインを入れ直します。'
  "$agy_bin" plugin uninstall "$plugin"
  replaced=1
fi

install_from() {
  local output
  if output=$("$agy_bin" plugin install "$1" 2>&1); then
    printf '%s\n' "$output"
    return 0
  fi
  printf '%s\n' "$output" >&2
  if [ "$replaced" = 0 ] &&
    printf '%s\n' "$output" | grep -Eiq 'already.*(exist|install|present|registered)|file exists|既に|すでに'; then
    replaced=1
    printf '%s\n' 'インストール済みのプラグインを入れ直します。'
    "$agy_bin" plugin uninstall "$plugin" || return 2
    "$agy_bin" plugin install "$1" || return 1
    return 0
  fi
  return 1
}

# ローカルのフォルダから入れるときは、.e2e-out・node_modules・.git などを除いた一時コピーを入れる
# （リポジトリ本体を指すと、検査の出力までコピーされてリンクで失敗するため）。
copy_dir=
cleanup() { [ -z "$copy_dir" ] || rm -rf -- "$copy_dir"; }
trap cleanup EXIT
if [ -d "$source" ]; then
  copy_dir=$(mktemp -d)
  mkdir -p -- "$copy_dir/$plugin"
  tar -C "$source" --exclude=.e2e-out --exclude=node_modules --exclude=.git \
    --exclude=.env --exclude=.clasp.json --exclude='*.local.json' -cf - . |
    tar -C "$copy_dir/$plugin" -xf -
  source=$copy_dir/$plugin
fi

if install_from "$source"; then
  :
else
  status=$?
  if [ "$status" = 2 ] || [ -n "${AICK_SOURCE:-}" ]; then exit 1; fi
  printf '%s\n' 'GitHub の ZIP を取得してインストールします。'
  temp_dir=$(mktemp -d)
  trap 'cleanup; rm -rf -- "$temp_dir"' EXIT
  curl -fsSL "$zip_url" -o "$temp_dir/plugin.zip"
  unzip -q "$temp_dir/plugin.zip" -d "$temp_dir"
  install_from "$temp_dir/ai-challenge-kit-main"
fi

work_dir=${AICK_HOME:-$HOME/ai-challenge}
mkdir -p -- "$work_dir"
if [ "$work_dir" = "$HOME/ai-challenge" ]; then
  printf '%s\n' 'ターミナルで cd ~/ai-challenge && agy を実行し、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。'
else
  printf 'ターミナルで cd %q && agy を実行し、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。\n' "$work_dir"
fi
printf 'または Antigravity で %s を開き、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。\n' "$work_dir"
