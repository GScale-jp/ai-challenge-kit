$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
if ($PSVersionTable.PSVersion.Major -lt 6) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

try {
    $global:LASTEXITCODE = 0
    Invoke-RestMethod 'https://antigravity.google/cli/install.ps1' | Invoke-Expression
    if ($LASTEXITCODE -ne 0) { throw "インストーラの終了コード: $LASTEXITCODE" }
} catch {
    Write-Host $_.Exception.Message
    Write-Host '::notice::agy の公式インストーラが失敗したため、厳格検証をスキップします。'
    exit 0
}

if ($env:LOCALAPPDATA) {
    $bin = Join-Path $env:LOCALAPPDATA 'agy/bin'
    $env:Path = $bin + [IO.Path]::PathSeparator + $env:Path
    if ($env:GITHUB_PATH) { [IO.File]::AppendAllText($env:GITHUB_PATH, "$bin`n") }
}
$agy = Get-Command agy -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $agy) {
    Write-Host '::notice::インストール後も agy が見つからないため、厳格検証をスキップします。'
    exit 0
}

Remove-Item Env:AGY_ADC_AUTH -ErrorAction SilentlyContinue
try {
    $ErrorActionPreference = 'Continue'
    $report = & $agy.Source plugin validate . --strict 2>&1
    $status = $LASTEXITCODE
    $report = ($report | Out-String).TrimEnd()
} catch {
    Write-Host $_.Exception.Message
    Write-Host '::notice::agy を起動できなかったため、厳格検証をスキップします。'
    exit 0
}
Write-Host $report
if ($status -eq 0) { exit 0 }
if ($status -in @(126, 127, 193, -1073741515) -or
    $report -match 'log[ -]?in|sign[ -]?in|authenticat|認証|ログイン|access is denied|cannot (?:execute|start)|not a valid Win32|失敗.+起動') {
    Write-Host '::notice::agy の認証または起動に失敗したため、厳格検証をスキップします。'
    exit 0
}
exit $status
