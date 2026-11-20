$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
if ($PSVersionTable.PSVersion.Major -lt 6) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

function Find-AickAgy {
    $candidates = @($env:AGY_BIN, 'agy')
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'agy/bin/agy.exe') }
    if ([IO.Path]::DirectorySeparatorChar -eq '/') { $candidates += (Join-Path $HOME '.local/bin/agy') }
    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $command = Get-Command -Name $candidate -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { return $command.Source }
    }
}

function Invoke-AickPlugin {
    # 5.1 ではネイティブコマンドの stderr が PowerShell のエラーに変換される。
    $ErrorActionPreference = 'Continue'
    $output = & $agyBin plugin @args 2>&1
    [pscustomobject]@{ Status = $LASTEXITCODE; Output = ($output | Out-String).TrimEnd() }
}

function Remove-AickPlugin {
    $result = Invoke-AickPlugin uninstall 'ai-challenge-kit'
    if ($result.Output) { Write-Host $result.Output }
    if ($result.Status -ne 0) { throw 'プラグインをアンインストールできませんでした。' }
}

function Install-AickPlugin([string]$Source) {
    $result = Invoke-AickPlugin install $Source
    if ($result.Output) { Write-Host $result.Output }
    if ($result.Status -ne 0 -and -not $state.Replaced -and $result.Output -match 'already.*(exist|install|present|registered)|file exists|既に|すでに') {
        $state.Replaced = $true
        Write-Host 'インストール済みのプラグインを入れ直します。'
        Remove-AickPlugin
        $result = Invoke-AickPlugin install $Source
        if ($result.Output) { Write-Host $result.Output }
    }
    return ($result.Status -eq 0)
}

# ローカルのフォルダから入れるときは、.e2e-out・node_modules・.git などを除いた一時コピーを入れる
# （リポジトリ本体を指すと、検査の出力までコピーされてリンクで失敗するため）。
function Copy-AickSource([string]$From, [string]$To) {
    New-Item -ItemType Directory -Path $To -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $From -Force) {
        if ($item.Name -in @('.e2e-out', 'node_modules', '.git', '.env', '.clasp.json') -or $item.Name -like '*.local.json') { continue }
        if ($item.PSIsContainer) { Copy-AickSource $item.FullName (Join-Path $To $item.Name) }
        else { Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $To $item.Name) }
    }
}

$copyDir = $null
try {
    $workDir = $env:AICK_HOME
    if (-not $workDir) { $workDir = Join-Path $HOME 'ai-challenge' }
    $agyBin = Find-AickAgy

    if ($env:AICK_UNINSTALL -eq '1') {
        if (-not $agyBin) { throw 'agy が見つかりません。' }
        Remove-AickPlugin
        Write-Host "${workDir} は削除せず、そのまま残しました。"
        return
    }

    if (-not $agyBin) {
        if ($env:AICK_YES -ne '1') {
            if ([Console]::IsInputRedirected) { throw '端末がない環境では AICK_YES=1 を指定してください。' }
            $answer = Read-Host '公式インストーラで agy を入れますか？ [y/N]'
            if ($answer -notmatch '^y(es)?$') { throw 'インストールを中止しました。' }
        }
        Write-Host 'agy をインストールします。'
        if ($env:AICK_AGY_INSTALLER_CMD) {
            $global:LASTEXITCODE = 0
            Invoke-Expression $env:AICK_AGY_INSTALLER_CMD
            if ($LASTEXITCODE -ne 0) { throw 'agy のインストーラが失敗しました。' }
        } else {
            $global:LASTEXITCODE = 0
            Invoke-RestMethod 'https://antigravity.google/cli/install.ps1' | Invoke-Expression
            if ($LASTEXITCODE -ne 0) { throw 'agy のインストーラが失敗しました。' }
        }
        $agyBin = Find-AickAgy
        if (-not $agyBin) { throw '公式インストーラの実行後も agy が見つかりません。' }
    }

    $state = @{ Replaced = $false }
    $listed = Invoke-AickPlugin list
    if ($listed.Status -eq 0 -and $listed.Output -like '*ai-challenge-kit*') {
        Write-Host 'インストール済みのプラグインを入れ直します。'
        Remove-AickPlugin
        $state.Replaced = $true
    }

    $source = $env:AICK_SOURCE
    if (-not $source) { $source = 'https://github.com/GScale-jp/ai-challenge-kit' }
    if (Test-Path -LiteralPath $source -PathType Container) {
        $copyDir = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
        $copied = Join-Path $copyDir 'ai-challenge-kit'
        Copy-AickSource (Resolve-Path -LiteralPath $source).ProviderPath $copied
        $source = $copied
    }
    if (-not (Install-AickPlugin $source)) {
        if ($env:AICK_SOURCE) { throw 'プラグインをインストールできませんでした。' }
        Write-Host 'GitHub の ZIP を取得してインストールします。'
        $tempDir = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        try {
            $zip = Join-Path $tempDir 'plugin.zip'
            Invoke-WebRequest -UseBasicParsing -Uri 'https://codeload.github.com/GScale-jp/ai-challenge-kit/zip/refs/heads/main' -OutFile $zip
            Expand-Archive -LiteralPath $zip -DestinationPath $tempDir
            if (-not (Install-AickPlugin (Join-Path $tempDir 'ai-challenge-kit-main'))) {
                throw 'プラグインをインストールできませんでした。'
            }
        } finally {
            Remove-Item -LiteralPath $tempDir -Recurse -Force
        }
    }

    New-Item -ItemType Directory -Path $workDir -Force | Out-Null
    $quotedDir = $workDir.Replace("'", "''")
    Write-Host "PowerShell で cd '${quotedDir}' を実行し、agy を起動して /ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。"
    Write-Host "または Antigravity で ${workDir} を開き、/ai-challenge-kit:challenge と入力してください（/aic まで打って、候補から選んでもかまいません）。"
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    if ($copyDir -and (Test-Path -LiteralPath $copyDir)) { Remove-Item -LiteralPath $copyDir -Recurse -Force }
    exit 1
}
if ($copyDir -and (Test-Path -LiteralPath $copyDir)) { Remove-Item -LiteralPath $copyDir -Recurse -Force }
