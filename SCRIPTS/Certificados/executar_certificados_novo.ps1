# Orquestrador para ingestão direta de certificados usando o pipeline oficial em Python

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptRoot "..\backend\.env"

if (-not (Test-Path $EnvFile)) {
    Write-Host "Arquivo .env não encontrado em $EnvFile" -ForegroundColor Red
    exit 1
}

# Carrega variáveis do .env
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        [Environment]::SetEnvironmentVariable($name, $value)
    }
}

$BackendRoot = Split-Path $EnvFile -Parent
$ScriptIngest = Join-Path $BackendRoot "scripts\certificates_orchestrate.py"

# Determina o Python a ser usado
$VenvPython = Join-Path $BackendRoot ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $PythonPath = $VenvPython
} else {
    $PythonPath = "python"
}

Write-Host "`n=== INGERINDO CERTIFICADOS DIRETO NO BANCO ===" -ForegroundColor Cyan
Write-Host ""

& "$PythonPath" "$ScriptIngest"
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    $errIcon = "[!]"
    Write-Host "`n$errIcon Script Python finalizou com erro (código $exitCode)." -ForegroundColor Red
    Write-Host "`nDicas:" -ForegroundColor Yellow
    Write-Host "  - Verifique se a venv e dependências estão corretas" -ForegroundColor Yellow
    Write-Host "  - Teste a conexão com o banco manualmente" -ForegroundColor Yellow
    Write-Host "  - Verifique os logs acima para detalhes do erro`n" -ForegroundColor Yellow
    exit $exitCode
}

Write-Host "`nCertificados ingeridos com sucesso pelo pipeline Python oficial." -ForegroundColor Green
