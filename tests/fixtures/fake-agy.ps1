$ErrorActionPreference = 'Stop'
$encoding = New-Object Text.UTF8Encoding($false)
[IO.File]::AppendAllText($env:FAKE_AGY_LOG, (($args -join ' ') + [Environment]::NewLine), $encoding)
switch ($args[1]) {
    'list' {
        if ($env:FAKE_AGY_LIST_FAIL -eq '1') { exit 1 }
        if ($env:FAKE_AGY_INSTALLED -eq '1') { Write-Output 'ai-challenge-kit' }
    }
    'install' {
        if ($env:FAKE_AGY_SEEN -and (Test-Path -LiteralPath $args[2] -PathType Container)) {
            [IO.File]::AppendAllText($env:FAKE_AGY_SEEN, ((Get-ChildItem -LiteralPath $args[2] -Force | ForEach-Object Name) -join [Environment]::NewLine) + [Environment]::NewLine, $encoding)
        }
        if ($env:FAKE_AGY_FAIL_URL -eq '1' -and $args[2] -like 'https://*') {
            [Console]::Error.WriteLine('URLからインストールできません。')
            exit 1
        }
        if ($env:FAKE_AGY_CONFLICT -eq '1' -and
            [IO.File]::ReadAllLines($env:FAKE_AGY_LOG, $encoding) -notcontains 'plugin uninstall ai-challenge-kit') {
            [Console]::Error.WriteLine('プラグインはすでに存在します。')
            exit 1
        }
    }
}
exit 0
