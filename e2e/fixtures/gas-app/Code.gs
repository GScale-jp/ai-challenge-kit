// E2E 用の最小の GAS アプリ（deploy の dry-run だけに使う）
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index').setTitle('備えのチェック');
}
