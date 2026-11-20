#!/usr/bin/env bash
# Mac 実機で、本物の agy を使って全工程を通す検査。
# 例題は「台風の前の家族の備え」。各段の出力・生成物・スクリーンショットは .e2e-out/<日時>/ に残る。
# 使い方: bash e2e/run_e2e.sh [段番号1〜13 ...]   （省略すると 1〜13。14 のアンインストールは必ず行う）
set -euo pipefail
umask 077

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
timeout=${AICK_E2E_TIMEOUT:-600}
if [[ ! "$timeout" =~ ^[1-9][0-9]{0,5}$ ]]; then
  printf '%s\n' 'AICK_E2E_TIMEOUT は秒数を正の整数で指定してください。' >&2
  exit 1
fi
export AICK_E2E_TIMEOUT="$timeout"
export PATH="$PATH:$HOME/.local/bin:$HOME/.antigravity/bin"

last=14
names=('' '厳格検証' 'インストール' 'アイデア出し' '試作検討' '壁打ち' 'アプリ作成' 'デプロイ（dry-run）' '動画の台本' '動画の作成' '応募文' 'フォーム入力' 'LT スライド' 'クレジット受取' 'アンインストール')
# 前提の段（前の段の成果物を使う）
deps=('' '' '' '2' '3' '4' '5' '2' '6' '8' '5' '10' '10' '2' '')
selected=(); required=(); results=(); notes=()
for stage in $(seq 0 $last); do
  selected[$stage]=0; required[$stage]=0; results[$stage]=SKIP; notes[$stage]='対象外'
done
if [ "$#" = 0 ]; then set -- 1 2 3 4 5 6 7 8 9 10 11 12 13; fi
for stage in "$@"; do
  if [[ "$stage" =~ ^([1-9]|1[0-3])$ ]]; then
    selected[$stage]=1; required[$stage]=1
  else
    printf '%s\n' '使い方: bash e2e/run_e2e.sh [段番号1〜13 ...]' >&2; exit 1
  fi
done
# 前提の段を足す（クレジット受取は AICK_VOUCHER_URL があるときだけ）
for _ in $(seq 1 $last); do
  for stage in $(seq 3 12); do
    if [ "${required[$stage]}" = 1 ]; then
      for dep in ${deps[$stage]}; do required[$dep]=1; done
    fi
  done
done
if [ "${required[13]}" = 1 ]; then required[2]=1; fi
required[14]=1

out="$root/.e2e-out/$(date +%Y%m%d-%H%M%S)"
mkdir -p -- "$root/.e2e-out"
if ! mkdir -- "$out"; then
  printf '%s\n' '同じ時刻の出力先があるため、開始できませんでした。' >&2
  exit 1
fi
workspace=
agy_available=0
server_pid=

agy_timed() {
  node "$root/e2e/run_with_timeout.mjs" "$timeout" env -u AGY_ADC_AUTH agy "$@"
}

finish() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null; fi
  if [ "$agy_available" = 1 ]; then
    if agy_timed plugin uninstall ai-challenge-kit >"$out/14-uninstall.log" 2>&1; then
      results[14]=PASS
      notes[14]='削除を確認'
    elif agy_timed plugin list >"$out/14-list.log" 2>&1 && ! grep -Fq ai-challenge-kit "$out/14-list.log"; then
      results[14]=PASS
      notes[14]='プラグインは登録されていません'
    else
      results[14]=FAIL
      notes[14]='14-uninstall.log を確認'
    fi
  else
    results[14]=SKIP
    notes[14]='agy を実行できません'
  fi
  if [ -n "$workspace" ] && [ -d "$workspace/home" ]; then
    # 作業フォルダの成果物（アプリ・台本・動画・応募文・スライド）をそのまま残す。個人の情報は入っていない。
    mkdir -p -- "$out/workspace"
    for dir in challenge app gas-app; do
      if [ -d "$workspace/home/$dir" ]; then cp -R -- "$workspace/home/$dir" "$out/workspace/$dir" 2>/dev/null; fi
    done
  fi
  if [ -n "$workspace" ]; then rm -rf -- "$workspace" || status=1; fi
  {
    printf '\n| 段名 | 結果 | 備考 |\n| --- | --- | --- |\n'
    for stage in $(seq 1 $last); do
      printf '| %s. %s | %s | %s |\n' "$stage" "${names[$stage]}" "${results[$stage]}" "${notes[$stage]}"
    done
    printf '\n記録先: %s\n' "$out"
  } | tee "$out/summary.txt" || status=1
  for stage in $(seq 1 $last); do
    if [ "${results[$stage]}" = FAIL ]; then status=1; fi
  done
  exit "$status"
}

trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! command -v node >/dev/null 2>&1 || ! command -v agy >/dev/null 2>&1; then
  printf '%s\n' 'Node.js または agy が見つかりません。' >&2
  exit 1
fi
agy_available=1
if [ "${required[2]}" = 1 ]; then
  workspace=$(mktemp -d)
fi

ws() { printf '%s/home/%s' "$workspace" "$1"; }

validate() {
  agy_timed plugin validate . --strict >"$out/1-validate.log" 2>&1 || return 1
  # 「0 warnings」のような件数表示は警告から除く。
  if sed -E 's/(^|[^0-9])[[:blank:]]*0[[:blank:]]+(warnings?|警告)//Ig; s/警告[[:blank:]]*:[[:blank:]]*0([^0-9]|$)//g' \
    "$out/1-validate.log" | grep -Ei 'warn|警告' >"$out/1-warnings.log"; then
    return 1
  fi
}

install_plugin() {
  cat >"$workspace/agy-no-adc" <<'WRAPPER'
#!/usr/bin/env bash
exec env -u AGY_ADC_AUTH agy "$@"
WRAPPER
  chmod +x "$workspace/agy-no-adc" || return 1
  AICK_SOURCE="$root" AICK_HOME="$workspace/home" AGY_BIN="$workspace/agy-no-adc" \
    node "$root/e2e/run_with_timeout.mjs" "$timeout" bash "$root/install/install.sh" --yes \
    >"$out/2-install.log" 2>&1
  mkdir -p -- "$workspace/home/challenge" "$out/challenge"
}

# 本物の agy にスキルを呼ばせる。引数: スキル名 回答ファイル（ログ名にも使う）
stream() {
  local name=$1 answers=$2
  (cd "$workspace/home" && node "$root/e2e/agy_stream.mjs" "$name" "$out/$name.ndjson" "$answers") \
    >"$out/$name.log" 2>&1
}

keep() {
  # 成果物を出力先へ写す（無ければ失敗）
  local rel=$1 log=$2
  mkdir -p -- "$out/$(dirname -- "$rel")"
  cp -R -- "$workspace/home/$rel" "$out/$rel" >>"$out/$log" 2>&1
}

need() {
  # 前提の成果物があるか。無ければ SKIP にする
  local stage=$1 rel=$2
  if [ -e "$(ws "$rel")" ]; then return 0; fi
  notes[$stage]="前提の成果物がありません: $rel"
  return 1
}

stage_idea() {
  stream idea-spark "$root/e2e/answers_idea.txt" || return 1
  keep challenge/idea.md idea-spark.log || return 1
  node "$root/e2e/check_markdown.mjs" "$out/challenge/idea.md" "$root/e2e/expected/idea.md" >>"$out/idea-spark.log" 2>&1
}

stage_prototype() {
  stream prototype-check "$root/e2e/answers_prototype.txt" || return 1
  keep challenge/prototype_check.md prototype-check.log || return 1
  node "$root/e2e/check_markdown.mjs" "$out/challenge/prototype_check.md" "$root/e2e/expected/prototype_check.md" >>"$out/prototype-check.log" 2>&1
}

stage_kabeuchi() {
  local template="$root/skills/kabeuchi/references/requirements_template.md"
  stream kabeuchi "$root/e2e/answers_kabeuchi.txt" || return 1
  keep challenge/requirements.md kabeuchi.log || return 1
  node "$root/e2e/check_markdown.mjs" "$out/challenge/requirements.md" "$template" >>"$out/kabeuchi.log" 2>&1
}

stage_build_app() {
  stream build-app "$root/e2e/answers_build.txt" || return 1
  keep app build-app.log || return 1
  node "$root/e2e/run_with_timeout.mjs" "$timeout" node "$root/e2e/check_app.mjs" \
    "$workspace/home/app/index.html" "$out/app.png" "$root/.e2e-out/tool" >>"$out/build-app.log" 2>&1
}

stage_deploy() {
  cp -R -- "$root/e2e/fixtures/gas-app" "$workspace/home/gas-app" || return 1
  stream deploy "$root/e2e/answers_deploy.txt" || return 1
  keep challenge/deploy_dry_run.txt deploy.log || return 1
  node "$root/e2e/verify.mjs" deploy-dry-run "$out/challenge/deploy_dry_run.txt" >>"$out/deploy.log" 2>&1 || return 1
  # clasp を実際には呼んでいない（作業用のコピーや設定ファイルが作られていない）ことを確かめる
  if [ -e "$workspace/home/.clasp.json" ] || [ -e "$workspace/home/.gas-deploy/.clasp.json" ]; then
    printf '%s\n' 'dry-run のはずが .clasp.json が作られています。' >>"$out/deploy.log"
    return 1
  fi
  keep challenge/deploy.md deploy.log || return 1
  node "$root/e2e/check_markdown.mjs" "$out/challenge/deploy.md" "$root/e2e/expected/deploy.md" >>"$out/deploy.log" 2>&1
}

stage_video_script() {
  stream demo-video "$root/e2e/answers_video_script.txt" || return 1
  keep challenge/video_script.md demo-video.log || return 1
  node "$root/e2e/check_markdown.mjs" "$out/challenge/video_script.md" >>"$out/demo-video.log" 2>&1 || return 1
  node "$root/e2e/verify.mjs" video-script "$out/challenge/video_script.md" >>"$out/demo-video.log" 2>&1
}

stage_make_video() {
  stream make-video "$root/e2e/answers_make_video.txt" || return 1
  keep challenge/demo.webm make-video.log || return 1
  node "$root/e2e/run_with_timeout.mjs" "$timeout" node "$root/e2e/verify.mjs" video \
    "$out/challenge/demo.webm" "$out/demo_frame.png" >>"$out/make-video.log" 2>&1
}

stage_entry_form() {
  stream entry-form "$root/e2e/answers_entry_form.txt" || return 1
  keep challenge/entry_form.md entry-form.log || return 1
  keep challenge/entry_form.json entry-form.log || return 1
  node "$root/e2e/check_markdown.mjs" "$out/challenge/entry_form.md" >>"$out/entry-form.log" 2>&1 || return 1
  node "$root/e2e/verify.mjs" entry-json "$out/challenge/entry_form.json" >>"$out/entry-form.log" 2>&1
}

stage_entry_submit() {
  # 本物の公式フォームには入力せず、ローカルのダミーフォーム（実物と同じ構造）に入力する。
  local port_file="$workspace/port" events="$out/entry_submit_events.log" port= tries=0
  node "$root/e2e/serve_dummy.mjs" "$port_file" "$events" &
  server_pid=$!
  while [ ! -s "$port_file" ] && [ "$tries" -lt 50 ]; do sleep 0.2; tries=$((tries + 1)); done
  port=$(cat "$port_file" 2>/dev/null || true)
  if [ -z "$port" ]; then printf '%s\n' 'ダミーフォームを起動できません。' >"$out/entry-submit.log"; return 1; fi
  local url="http://127.0.0.1:$port/dummy_form_md.html"
  {
    printf '%s\n' '/ai-challenge-kit:entry-submit'
    printf '%s\n' "氏名とメールは entry_form.json のとおりでよいです。動画の URL は https://youtu.be/e2eexample0 で、YouTube Studio で限定公開にしてあります。入力の方法は②の fill_form.mjs を使います。ただしこれは検査なので、公式のフォームではなく、ローカルのダミーフォーム $url に入力してください。初回の準備（npm install と npx playwright install chromium）は私が了承済みなので、あなたが実行してください。"
    printf '%s\n' '入力は --headless --no-keep-open --report challenge/entry_submit_report.json --screenshot challenge/entry_submit.png を付けて実行してください。同意3点のチェックと送信ボタンは絶対に押さないでください。入力が終わったら、進み具合の記録まで最後まで進めてください。'
  } >"$workspace/answers_entry_submit.txt"
  stream entry-submit "$workspace/answers_entry_submit.txt" || { kill "$server_pid" 2>/dev/null; server_pid=; return 1; }
  kill "$server_pid" 2>/dev/null; server_pid=
  keep challenge/entry_submit_report.json entry-submit.log || return 1
  keep challenge/entry_submit.png entry-submit.log || return 1
  node "$root/e2e/verify.mjs" entry-submit "$out/challenge/entry_submit_report.json" "$events" >>"$out/entry-submit.log" 2>&1
}

stage_lt() {
  stream lt-slides "$root/e2e/answers_lt.txt" || return 1
  keep challenge/lt lt-slides.log || return 1
  [ -s "$out/challenge/lt/lt.html" ] && [ -s "$out/challenge/lt/lt.pdf" ] || {
    printf '%s\n' 'lt.html または lt.pdf がありません。' >>"$out/lt-slides.log"; return 1; }
  # 契約テスト（合計300秒以内・文字数・見出し・最後に URL）をこちらでも流す
  (cd "$workspace/home" && node "$root/skills/lt-slides/scripts/check_deck.mjs") >>"$out/lt-slides.log" 2>&1 || return 1
  node "$root/e2e/screenshot.mjs" "$out/challenge/lt/lt.html" "$out/lt_slide1.png" 3000 >>"$out/lt-slides.log" 2>&1 || true
}

stage_voucher() {
  case "$AICK_VOUCHER_URL" in
    http://*|https://*) (cd "$workspace/home" && node "$root/e2e/agy_stream.mjs" voucher "$out/voucher.ndjson") >"$out/voucher.log" 2>&1 ;;
    *) printf '%s\n' 'AICK_VOUCHER_URL にテスト API の URL を指定してください。' >"$out/voucher.log"; return 1 ;;
  esac
}

run_stage() {
  local stage=$1 log=$2
  shift 2
  if [ "${required[$stage]}" != 1 ]; then return 0; fi
  printf '%s. %s\n' "$stage" "${names[$stage]}"
  if "$@"; then
    results[$stage]=PASS
    notes[$stage]="$log"
    if [ "${selected[$stage]}" = 0 ]; then notes[$stage]="前提段として実行。$log"; fi
  else
    results[$stage]=FAIL
    notes[$stage]="$log を確認"
  fi
}

# 段を実行する。インストール（2）が済んでいない、または前提の成果物が無いときは SKIP にする。
run_after() {
  local stage=$1 log=$2 file=$3
  shift 3
  if [ "${required[$stage]}" != 1 ]; then return 0; fi
  if [ "${results[2]}" != PASS ]; then notes[$stage]='前提の段 2 が未完了'; return 0; fi
  if [ -n "$file" ] && ! need "$stage" "$file"; then return 0; fi
  run_stage "$stage" "$log" "$@"
}

run_stage 1 1-validate.log validate
run_stage 2 2-install.log install_plugin
run_after 3 idea-spark.log '' stage_idea
run_after 4 prototype-check.log challenge/idea.md stage_prototype
run_after 5 kabeuchi.log '' stage_kabeuchi
run_after 6 build-app.log challenge/requirements.md stage_build_app
run_after 7 deploy.log '' stage_deploy
run_after 8 demo-video.log app/index.html stage_video_script
run_after 9 make-video.log challenge/video_script.md stage_make_video
run_after 10 entry-form.log challenge/requirements.md stage_entry_form
run_after 11 entry-submit.log challenge/entry_form.json stage_entry_submit
run_after 12 lt-slides.log challenge/entry_form.json stage_lt
if [ "${required[13]}" = 1 ]; then
  if [ -n "${AICK_VOUCHER_URL:-}" ]; then run_after 13 voucher.log '' stage_voucher
  else notes[13]='AICK_VOUCHER_URL が未設定'
  fi
fi
