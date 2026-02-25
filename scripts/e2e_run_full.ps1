[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    chcp 65001 | Out-Null
} catch {
    Write-Warning "Nao foi possivel executar chcp 65001: $($_.Exception.Message)"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$env:PYTHONUTF8 = "1"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$composeFile = Join-Path $repoRoot "infra\docker-compose.yml"
$logDir = Join-Path $PSScriptRoot ".e2e-logs"

$apiBaseUrlRaw = if ([string]::IsNullOrWhiteSpace($env:ECONTROLE_E2E_API_BASE_URL)) { "http://127.0.0.1:8020" } else { $env:ECONTROLE_E2E_API_BASE_URL }
$portalBaseUrlRaw = if ([string]::IsNullOrWhiteSpace($env:ECONTROLE_E2E_PORTAL_BASE_URL)) { "http://127.0.0.1:5174" } else { $env:ECONTROLE_E2E_PORTAL_BASE_URL }
$apiBaseUrl = ($apiBaseUrlRaw.Trim()).TrimEnd("/")
$portalBaseUrl = ($portalBaseUrlRaw.Trim()).TrimEnd("/")

if ([string]::IsNullOrWhiteSpace($env:ECONTROLE_EMAIL) -or [string]::IsNullOrWhiteSpace($env:ECONTROLE_PASSWORD)) {
    throw "Defina ECONTROLE_EMAIL e ECONTROLE_PASSWORD antes de rodar o E2E."
}

function Write-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-PythonExe {
    $candidates = @(
        (Join-Path $repoRoot ".venv\Scripts\python.exe"),
        (Join-Path $backendDir ".venv\Scripts\python.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        return $pythonCmd.Source
    }

    throw "Python nao encontrado. Ajuste PATH ou crie .venv em '$repoRoot\.venv'."
}

function Resolve-NpmExe {
    $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if ($npmCmd) {
        return $npmCmd.Source
    }

    $npm = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($npm) {
        return $npm.Source
    }

    throw "npm nao encontrado no PATH."
}

function Invoke-CommandChecked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter()][string[]]$Arguments = @(),
        [Parameter()][string]$WorkingDirectory = $repoRoot
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao executar: $FilePath $($Arguments -join ' ') (exit=$LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

function Test-PortInUse {
    param([Parameter(Mandatory = $true)][int]$Port)

    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { return $true }
    } catch {
        # fallback below
    }

    $netstatOutput = netstat -ano -p tcp 2>$null | Select-String -Pattern "[:\.]$Port\s+.*LISTENING"
    return [bool]$netstatOutput
}

function Wait-HttpOk {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 60,
        [int]$IntervalSeconds = 2
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
                return
            }
        } catch {
            Start-Sleep -Seconds $IntervalSeconds
            continue
        }

        Start-Sleep -Seconds $IntervalSeconds
    }

    throw "Timeout aguardando URL responder com sucesso: $Url"
}

function Test-ApiLoginCredentials {
    param(
        [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
        [Parameter(Mandatory = $true)][string]$Email,
        [Parameter(Mandatory = $true)][string]$Password
    )

    $loginUrl = "$ApiBaseUrl/api/v1/auth/login"
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress

    try {
        $response = Invoke-WebRequest `
            -Uri $loginUrl `
            -Method POST `
            -UseBasicParsing `
            -TimeoutSec 10 `
            -ContentType "application/json; charset=utf-8" `
            -Body $body
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            return
        }
        throw "status=$($response.StatusCode)"
    } catch {
        $statusCode = ""
        $responseText = ""
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $responseText = $reader.ReadToEnd()
                    $reader.Dispose()
                }
            } catch {}
        }

        $details = if ($responseText) { " Resposta: $responseText" } else { "" }
        $statusInfo = if ($statusCode) { " (HTTP $statusCode)" } else { "" }
        throw "Credenciais E2E invalidas para '$Email'$statusInfo. Ajuste ECONTROLE_EMAIL/ECONTROLE_PASSWORD para um usuario real com role DEV.$details"
    }
}

function Wait-DockerContainerHealthy {
    param(
        [Parameter(Mandatory = $true)][string]$ContainerName,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $status = (& docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $ContainerName 2>$null)
        if ($LASTEXITCODE -eq 0) {
            $status = ($status | Out-String).Trim()
            if ($status -eq "healthy" -or $status -eq "running") {
                return
            }
        }
        Start-Sleep -Seconds 2
    }

    throw "Container '$ContainerName' nao ficou healthy/running em ${TimeoutSeconds}s."
}

function Start-BackgroundCmdProcess {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$StdOutLog,
        [Parameter(Mandatory = $true)][string]$StdErrLog
    )

    return Start-Process `
        -FilePath "cmd.exe" `
        -ArgumentList @("/c", $CommandLine) `
        -WorkingDirectory $WorkingDirectory `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $StdOutLog `
        -RedirectStandardError $StdErrLog
}

function Stop-ProcessTreeSafe {
    param([System.Diagnostics.Process]$Process)

    if (-not $Process) { return }
    try {
        if (-not $Process.HasExited) {
            & taskkill /PID $Process.Id /T /F | Out-Null
        }
    } catch {
        Write-Warning "Falha ao encerrar PID $($Process.Id): $($_.Exception.Message)"
    }
}

function Show-LogTail {
    param(
        [string]$Path,
        [int]$Lines = 40
    )
    if (Test-Path $Path) {
        Write-Host "--- tail: $Path ---" -ForegroundColor DarkYellow
        Get-Content -Path $Path -Tail $Lines -ErrorAction SilentlyContinue
    }
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$pythonExe = Resolve-PythonExe
$npmExe = Resolve-NpmExe
$null = Get-Command docker -ErrorAction Stop

$apiUri = [Uri]$apiBaseUrl
if ($apiUri.Scheme -ne "http") {
    throw "ECONTROLE_E2E_API_BASE_URL deve usar http para o runner local. Valor atual: $apiBaseUrl"
}
$allowedApiHosts = @("127.0.0.1", "localhost")
if ($allowedApiHosts -notcontains $apiUri.Host) {
    throw "ECONTROLE_E2E_API_BASE_URL deve apontar para host local (127.0.0.1/localhost). Valor atual: $apiBaseUrl"
}
$apiPort = if ($apiUri.IsDefaultPort) { 80 } else { $apiUri.Port }
if ($apiPort -ne 8020) {
    throw "ECONTROLE_E2E_API_BASE_URL deve usar porta 8020 neste runner. Valor atual: $apiBaseUrl"
}

$portalUri = [Uri]$portalBaseUrl
if ($portalUri.Scheme -ne "http") {
    throw "ECONTROLE_E2E_PORTAL_BASE_URL deve usar http para o runner local. Valor atual: $portalBaseUrl"
}
$allowedPortalHosts = @("127.0.0.1", "localhost", "0.0.0.0")
if ($allowedPortalHosts -notcontains $portalUri.Host) {
    throw "ECONTROLE_E2E_PORTAL_BASE_URL deve apontar para host local ($($allowedPortalHosts -join ', ')). Valor atual: $portalBaseUrl"
}
$portalHostForVite = if ($portalUri.Host -eq "localhost") { "127.0.0.1" } else { $portalUri.Host }
$portalPort = if ($portalUri.IsDefaultPort) { 5174 } else { $portalUri.Port }

$uvicornCmd = "`"$pythonExe`" -m uvicorn main:app --host 127.0.0.1 --port 8020"
$portalCmd = "npm run dev -- --host $portalHostForVite --port $portalPort --strictPort"

$uvicornStdOut = Join-Path $logDir "uvicorn.stdout.log"
$uvicornStdErr = Join-Path $logDir "uvicorn.stderr.log"
$portalStdOut = Join-Path $logDir "portal.stdout.log"
$portalStdErr = Join-Path $logDir "portal.stderr.log"

$uvicornProcess = $null
$portalProcess = $null

try {
    Write-Step "1/10 Infra: docker compose up -d (Postgres + Redis)"
    Invoke-CommandChecked -FilePath "docker" -Arguments @("compose", "-f", $composeFile, "up", "-d") -WorkingDirectory $repoRoot
    Wait-DockerContainerHealthy -ContainerName "econtrole-postgres"
    Wait-DockerContainerHealthy -ContainerName "econtrole-redis"

    Write-Step "2/10 Backend: alembic upgrade head"
    Invoke-CommandChecked -FilePath $pythonExe -Arguments @("-m", "alembic", "upgrade", "head") -WorkingDirectory $backendDir

    Write-Step "3/10 Backend: pytest -q (rapidos)"
    Invoke-CommandChecked -FilePath $pythonExe -Arguments @("-m", "pytest", "-q") -WorkingDirectory $backendDir

    Write-Step "4/10 API: validar porta 8020 livre antes de subir uvicorn"
    if (Test-PortInUse -Port 8020) {
        throw "A porta 8020 ja esta em uso. Pare o processo atual antes de rodar scripts\e2e_run_full.ps1."
    }

    Write-Step "5/10 API: iniciar uvicorn em background e aguardar /healthz"
    $uvicornProcess = Start-BackgroundCmdProcess `
        -WorkingDirectory $backendDir `
        -CommandLine $uvicornCmd `
        -StdOutLog $uvicornStdOut `
        -StdErrLog $uvicornStdErr
    Start-Sleep -Seconds 1
    if ($uvicornProcess.HasExited) {
        Show-LogTail -Path $uvicornStdErr
        Show-LogTail -Path $uvicornStdOut
        throw "uvicorn encerrou imediatamente (PID $($uvicornProcess.Id))."
    }
    Wait-HttpOk -Url "$apiBaseUrl/healthz" -TimeoutSeconds 90
    Test-ApiLoginCredentials -ApiBaseUrl $apiBaseUrl -Email $env:ECONTROLE_EMAIL -Password $env:ECONTROLE_PASSWORD

    Write-Step "6/10 API E2E: pytest -m e2e"
    Invoke-CommandChecked -FilePath $pythonExe -Arguments @("-m", "pytest", "-q", "-m", "e2e", "tests_e2e/api") -WorkingDirectory $repoRoot

    Write-Step "7/10 Portal: iniciar Vite em background e aguardar URL"
    $env:VITE_API_BASE_URL = $apiBaseUrl
    $portalProcess = Start-BackgroundCmdProcess `
        -WorkingDirectory $frontendDir `
        -CommandLine $portalCmd `
        -StdOutLog $portalStdOut `
        -StdErrLog $portalStdErr
    Start-Sleep -Seconds 2
    if ($portalProcess.HasExited) {
        Show-LogTail -Path $portalStdErr
        Show-LogTail -Path $portalStdOut
        throw "Portal (vite) encerrou imediatamente (PID $($portalProcess.Id))."
    }
    Wait-HttpOk -Url "$portalBaseUrl/login" -TimeoutSeconds 120

    Write-Step "8/10 Portal E2E: Playwright"
    Invoke-CommandChecked -FilePath $npmExe -Arguments @("run", "test:e2e") -WorkingDirectory $frontendDir

    Write-Step "9/10 Concluido: API + Portal E2E passaram"
    Write-Host "Logs: $logDir" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "E2E falhou: $($_.Exception.Message)" -ForegroundColor Red
    Show-LogTail -Path $uvicornStdErr
    Show-LogTail -Path $uvicornStdOut
    Show-LogTail -Path $portalStdErr
    Show-LogTail -Path $portalStdOut
    throw
} finally {
    Write-Step "10/10 Cleanup: encerrar processos iniciados (uvicorn + portal)"
    Stop-ProcessTreeSafe -Process $portalProcess
    Stop-ProcessTreeSafe -Process $uvicornProcess
}
