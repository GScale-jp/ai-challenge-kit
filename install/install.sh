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

# Google Cloud Shell では、Playwright（動画・フォーム入力・スライド・画面確認で使う）の準備もここで済ませる。
# $HOME は残るので、node_modules・Chromium・Node.js 22 は $HOME に置き、2回目以降は入れ直さない
# （プラグインを入れ直しても、node_modules はリンクを張り直すだけで済む）。
# Cloud Shell の Node.js 26 では `playwright install` が ZIP の展開で止まる（2026-11-20 実機で確認）ので、
# 入れる作業だけ Node.js 22 で行う。Chromium が使う OS のライブラリは Cloud Shell に最初から入っている。
cloud_shell_setup() {
  local plugin_dir="${AICK_PLUGIN_DIR:-$HOME/.gemini/config/plugins/$plugin}"
  local cache="$HOME/.cache/ai-challenge-kit"
  local node22="$cache/node22" skill dir lock_sum name chrome
  printf '%s\n' 'Cloud Shell 用の準備をします（初回は5分ほどかかります。2回目以降はすぐ終わります）。'
  mkdir -p -- "$cache"
  if [ ! -x "$node22/bin/node" ]; then
    name=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep -o 'node-v22[^ ]*-linux-x64\.tar\.xz' | head -1)
    [ -n "$name" ] || return 1
    mkdir -p -- "$node22.tmp"
    curl -fsSL "https://nodejs.org/dist/latest-v22.x/$name" | tar -xJ --strip-components=1 -C "$node22.tmp" || return 1
    rm -rf -- "$node22" && mv -- "$node22.tmp" "$node22"
  fi
  for skill in build-app make-video entry-submit lt-slides; do
    dir="$plugin_dir/skills/$skill/scripts"
    [ -f "$dir/package-lock.json" ] || continue
    mkdir -p -- "$cache/$skill"
    lock_sum=$(cksum <"$dir/package-lock.json")
    if [ ! -d "$cache/$skill/node_modules" ] || [ "$(cat "$cache/$skill/.lock" 2>/dev/null)" != "$lock_sum" ]; then
      cp -- "$dir/package.json" "$dir/package-lock.json" "$cache/$skill/"
      (cd "$cache/$skill" && PATH="$node22/bin:$PATH" npm ci --no-fund --no-audit --loglevel=error) || return 1
      printf '%s' "$lock_sum" >"$cache/$skill/.lock"
    fi
    rm -rf -- "$dir/node_modules"
    ln -s -- "$cache/$skill/node_modules" "$dir/node_modules"
  done
  (cd "$cache/build-app" && PATH="$node22/bin:$PATH" node node_modules/playwright/cli.js install chromium) || return 1
  chrome=$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-*/chrome-headless-shell 2>/dev/null | tail -1)
  if [ -n "$chrome" ] && ldd "$chrome" 2>/dev/null | grep -q 'not found'; then
    (cd "$cache/build-app" && sudo env "PATH=$node22/bin:$PATH" node node_modules/playwright/cli.js install-deps chromium) || return 1
  fi
  printf '%s\n' 'Cloud Shell 用の準備が終わりました。'
}

if [ "${CLOUD_SHELL:-}" = true ] && [ "${AICK_SKIP_PLAYWRIGHT:-0}" != 1 ]; then
  if ! cloud_shell_setup; then
    printf '%s\n' 'Playwright の準備に失敗しました。もう一度このコマンドを実行してください。' >&2
  fi
fi
if [ "${CLOUD_SHELL:-}" = true ]; then
  printf '%s\n' 'Cloud Shell では、agy を起動して「1. Google OAuth」を選び、表示された URL をブラウザで開いてログインし、画面に出たコードを貼り付けてください。'
  printf '%s\n' '作ったアプリは、右上の「ウェブでプレビュー」（ポート 8080）で確かめます。'
fi
if [ "$work_dir" = "$HOME/ai-challenge" ]; then
  printf '%s\n' 'ターミナルで cd ~/ai-challenge && agy を実行し、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。'
else
  printf 'ターミナルで cd %q && agy を実行し、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。\n' "$work_dir"
fi
printf 'または Antigravity で %s を開き、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。\n' "$work_dir"
