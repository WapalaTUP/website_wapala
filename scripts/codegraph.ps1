param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CodeGraphArguments)

$ErrorActionPreference = 'Stop'
$taskCodegraphHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$taskCodegraphCli = Join-Path $taskCodegraphHome 'tools/codegraph/node_modules/.bin/codegraph.cmd'
if (-not (Test-Path -LiteralPath $taskCodegraphCli)) {
    throw 'CodeGraph CLI is unavailable. Use the codegraph skill fallback; do not install automatically.'
}

$taskEnvironmentNames = @('DO_NOT_TRACK', 'CODEGRAPH_TELEMETRY', 'CODEGRAPH_NO_UPDATE_CHECK')
$taskPreviousEnvironment = @{}
foreach ($taskEnvironmentName in $taskEnvironmentNames) {
    $taskPreviousEnvironment[$taskEnvironmentName] = [Environment]::GetEnvironmentVariable($taskEnvironmentName, 'Process')
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $env:DO_NOT_TRACK = '1'
    $env:CODEGRAPH_TELEMETRY = '0'
    $env:CODEGRAPH_NO_UPDATE_CHECK = '1'
    & $taskCodegraphCli @CodeGraphArguments
    $taskCodegraphExitCode = $LASTEXITCODE
} finally {
    Pop-Location
    foreach ($taskEnvironmentName in $taskEnvironmentNames) {
        [Environment]::SetEnvironmentVariable($taskEnvironmentName, $taskPreviousEnvironment[$taskEnvironmentName], 'Process')
    }
}
exit $taskCodegraphExitCode
