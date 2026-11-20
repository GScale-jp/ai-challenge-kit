param(
    [string]$Passphrase,
    [string]$Email,
    [string]$Name = '',
    [switch]$Test,
    [Alias('h')][switch]$Help
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

if ($Help -or -not $Passphrase -or -not $Email) {
    Write-Output '使い方: claim.ps1 -Passphrase 合言葉 -Email 個人のGmail [-Name 名前] [-Test]'
    Write-Output '配布用URLは環境変数 AICK_VOUCHER_URL でも指定できます。'
    if ($Help) { exit 0 }
    exit 1
}

$Email = $Email.ToLowerInvariant()
if ($Email -cnotmatch '\A[a-z0-9._%+-]+@gmail\.com\z') {
    [Console]::Error.WriteLine('クレジットは個人の Gmail（@gmail.com）のみに適用できます。')
    exit 2
}

$url = $env:AICK_VOUCHER_URL
if (-not $url) {
    try {
        $configPath = $env:AICK_VOUCHER_CONFIG
        if (-not $configPath) { $configPath = Join-Path (Split-Path $PSScriptRoot) 'config/endpoints.json' }
        $config = Get-Content -Encoding UTF8 -Raw -LiteralPath $configPath |
            ConvertFrom-Json
        $url = $config.prod
        if ($Test) { $url = $config.test }
    } catch {
        $url = $null
    }
}
if (-not $url -or $url.StartsWith('__')) {
    [Console]::Error.WriteLine('配布用URLがまだ設定されていません。')
    exit 3
}

$body = [Text.Encoding]::UTF8.GetBytes((@{
    passphrase = $Passphrase
    email = $Email
    name = $Name
} | ConvertTo-Json -Compress))

try {
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    }
    $uri = [Uri]$url
    $webOptions = @{}
    if ($PSVersionTable.PSVersion.Major -ge 7) { $webOptions.SkipHttpErrorCheck = $true }
    for ($redirects = 0; $redirects -le 10; $redirects++) {
        if ($uri.Scheme -notin @('http', 'https')) { throw '配布用URLの形式が無効です。' }
        $location = $null
        try {
            # GAS は最初の POST で処理し、結果を転送先に置く。転送先は本文なしの GET で取りに行く（POST し直すと 405）。
            if ($redirects -eq 0) {
                $response = Invoke-WebRequest @webOptions -Uri $uri -Method Post -UseBasicParsing -MaximumRedirection 0 `
                    -ContentType 'text/plain; charset=utf-8' -Body $body -TimeoutSec 30 -ErrorAction SilentlyContinue
            } else {
                $response = Invoke-WebRequest @webOptions -Uri $uri -Method Get -UseBasicParsing -MaximumRedirection 0 `
                    -TimeoutSec 30 -ErrorAction SilentlyContinue
            }
            if (-not $response) { throw 'HTTP 応答がありません。' }
            $status = [int]$response.StatusCode
            $location = [string](@($response.Headers['Location'])[0])
            if ($status -notin @(301, 302, 303, 307, 308)) {
                $stream = $response.RawContentStream
                $stream.Position = 0
                $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8)
                try { $json = $reader.ReadToEnd() } finally { $reader.Dispose() }
            }
        } catch {
            # 5.1 と 7 は自動追従を止めた際に異なる型の HTTP 応答を返す。
            $http = $_.Exception.Response
            if (-not $http) { throw }
            $status = [int]$http.StatusCode
            if ($http -is [Net.HttpWebResponse]) {
                $location = $http.Headers['Location']
                if ($status -ge 400) {
                    $reader = New-Object IO.StreamReader($http.GetResponseStream(), [Text.Encoding]::UTF8)
                    try { $json = $reader.ReadToEnd() } finally { $reader.Dispose() }
                }
                $http.Close()
            } else {
                $location = [string]$http.Headers.Location
                if ($status -ge 400) { $json = $http.Content.ReadAsStringAsync().GetAwaiter().GetResult() }
                $http.Dispose()
            }
        }
        if ($status -notin @(301, 302, 303, 307, 308)) { break }
        if (-not $location -or $redirects -eq 10) { throw '配布用URLのリダイレクトに失敗しました。' }
        $uri = [Uri]::new($uri, $location)
    }
} catch {
    [Console]::Error.WriteLine('配布用APIに接続できませんでした。')
    exit 4
}

try {
    $result = ConvertFrom-Json -InputObject $json
    if ($result.ok -isnot [bool]) { throw '応答に処理結果がありません。' }
    if (-not $result.ok) {
        if (-not $result.message) { throw '応答にエラーの説明がありません。' }
        [Console]::Error.WriteLine([string]$result.message)
        exit 1
    }
    if ($result.code -isnot [string] -or -not $result.code -or $result.code -match '[\x00-\x1F\x7F]' -or
        $result.redeem_url -isnot [string] -or $result.deadline -isnot [string] -or $result.steps -isnot [array]) {
        throw '応答にコードや手順がありません。'
    }
} catch {
    [Console]::Error.WriteLine('配布用APIの応答を読み取れませんでした。')
    exit 1
}

Write-Output "クレジットコード: $($result.code)"
if ($result.already_assigned -eq $true) { Write-Output 'すでに発行済みのコードです。' }
Write-Output "適用先: $($result.redeem_url)"
Write-Output "適用期限: $($result.deadline)"
Write-Output '適用手順:'
$index = 0
foreach ($step in $result.steps) {
    $index++
    Write-Output ('{0}. {1}' -f $index, ($step -replace '^\d+\.[ \t]*', ''))
}
Write-Output "AICK_CODE=$($result.code)"
