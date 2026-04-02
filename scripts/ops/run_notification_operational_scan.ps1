param(
  [string]$BaseUrl = $env:ECONTROLE_BASE_URL,
  [string]$Email = $env:ECONTROLE_EMAIL,
  [string]$Password = $env:ECONTROLE_PASSWORD,
  [int]$TimeoutSeconds = 0,
  [int]$PollIntervalSeconds = 0,
  [string]$ConfigFile = $env:ECONTROLE_SCAN_CONFIG_FILE,
  [string]$LogPath = "$env:ProgramData\eControle\logs\notification_operational_scan.log"
)

$ErrorActionPreference = "Stop"

function Ensure-LogDir {
  $dir = Split-Path $LogPath -Parent
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Force $dir | Out-Null
  }
}

function Write-Log([string]$msg) {
  Ensure-LogDir
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$ts] $msg"
  Add-Content -Path $LogPath -Value $line
  Write-Host $line
}

function Read-ConfigFile([string]$path) {
  $map = @{}
  if ([string]::IsNullOrWhiteSpace($path)) { return $map }
  if (!(Test-Path $path)) { throw "ConfigFile nao encontrado: $path" }

  Get-Content -Path $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($key -ne "") { $map[$key] = $value }
  }
  return $map
}

function Resolve-Setting([string]$currentValue, [hashtable]$cfg, [string]$cfgKey, [string]$defaultValue = "") {
  if (![string]::IsNullOrWhiteSpace($currentValue)) { return $currentValue }
  if ($cfg.ContainsKey($cfgKey) -and ![string]::IsNullOrWhiteSpace($cfg[$cfgKey])) { return $cfg[$cfgKey] }
  return $defaultValue
}

function Resolve-SettingInt([int]$currentValue, [hashtable]$cfg, [string]$cfgKey, [int]$defaultValue) {
  if ($currentValue -gt 0) { return $currentValue }
  if ($cfg.ContainsKey($cfgKey)) {
    $parsed = 0
    if ([int]::TryParse([string]$cfg[$cfgKey], [ref]$parsed) -and $parsed -gt 0) { return $parsed }
  }
  return $defaultValue
}

function Assert-Required([string]$value, [string]$name) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Parametro obrigatorio ausente: $name"
  }
}

function Invoke-JsonRequest([string]$method, [string]$uri, [hashtable]$headers = $null, [object]$body = $null, [int]$timeoutSec = 60) {
  try {
    if ($null -eq $body) {
      return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -TimeoutSec $timeoutSec
    }
    $json = $body | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec $timeoutSec
  }
  catch {
    $details = ""
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $details = $_.ErrorDetails.Message
    }
    $msg = $_.Exception.Message
    if ($details) {
      throw "$msg | response=$details"
    }
    throw $msg
  }
}

try {
  $cfg = Read-ConfigFile $ConfigFile

  $BaseUrl = Resolve-Setting $BaseUrl $cfg "ECONTROLE_BASE_URL" "http://localhost:8020/api/v1"
  $Email = Resolve-Setting $Email $cfg "ECONTROLE_EMAIL" ""
  $Password = Resolve-Setting $Password $cfg "ECONTROLE_PASSWORD" ""
  $TimeoutSeconds = Resolve-SettingInt $TimeoutSeconds $cfg "ECONTROLE_SCAN_TIMEOUT_SECONDS" 1800
  $PollIntervalSeconds = Resolve-SettingInt $PollIntervalSeconds $cfg "ECONTROLE_SCAN_POLL_INTERVAL_SECONDS" 10

  Assert-Required $BaseUrl "ECONTROLE_BASE_URL / -BaseUrl"
  Assert-Required $Email "ECONTROLE_EMAIL / -Email"
  Assert-Required $Password "ECONTROLE_PASSWORD / -Password"

  $BaseUrl = $BaseUrl.TrimEnd("/")
  Write-Log "START notification operational scan | base_url=$BaseUrl timeout=${TimeoutSeconds}s poll=${PollIntervalSeconds}s"

  Write-Log "Auth login..."
  $loginResp = Invoke-JsonRequest "POST" "$BaseUrl/auth/login" $null @{ email = $Email; password = $Password } 60
  $token = [string]$loginResp.access_token
  Assert-Required $token "access_token no login"

  $headers = @{ Authorization = "Bearer $token" }
  Write-Log "Triggering POST /notificacoes/scan-operacional ..."
  $startResp = Invoke-JsonRequest "POST" "$BaseUrl/notificacoes/scan-operacional" $headers @{} 60
  $runId = [string]$startResp.run_id
  Assert-Required $runId "run_id do scan-operacional"
  Write-Log "Run started | run_id=$runId status=$($startResp.status)"

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $finalStatus = ""
  $lastPayload = $null

  while ((Get-Date) -lt $deadline) {
    $jobResp = Invoke-JsonRequest "GET" "$BaseUrl/worker/jobs/$runId" $headers $null 60
    $lastPayload = $jobResp
    $status = ([string]$jobResp.status).ToLowerInvariant()
    Write-Log "Polling run_id=$runId status=$status processed=$($jobResp.processed)/$($jobResp.total)"

    if ($status -eq "completed") {
      $finalStatus = $status
      break
    }
    if ($status -eq "failed" -or $status -eq "cancelled") {
      $finalStatus = $status
      break
    }
    Start-Sleep -Seconds $PollIntervalSeconds
  }

  if ([string]::IsNullOrWhiteSpace($finalStatus)) {
    Write-Log "TIMEOUT run_id=$runId exceeded ${TimeoutSeconds}s"
    exit 1
  }

  $summary = "run_id=$runId final_status=$finalStatus total=$($lastPayload.total) processed=$($lastPayload.processed) emitted=$($lastPayload.ok_count) deduped=$($lastPayload.skipped_count) errors=$($lastPayload.error_count)"
  Write-Log "END $summary"

  if ($finalStatus -eq "completed") {
    exit 0
  }
  exit 1
}
catch {
  Write-Log ("ERROR " + $_.Exception.Message)
  exit 1
}
