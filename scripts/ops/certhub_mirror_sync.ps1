param(
  [Parameter(Mandatory=$true)]
  [string]$BaseUrl,

  [Parameter(Mandatory=$true)]
  [string]$OrgSlug,

  [Parameter(Mandatory=$true)]
  [string]$Email,

  [Parameter(Mandatory=$true)]
  [string]$PasswordFile,

  [string]$LogPath = "$env:ProgramData\eControle\logs\certhub_mirror_sync.log"
)

$ErrorActionPreference = "Stop"

function Ensure-LogDir() {
  $dir = Split-Path $LogPath -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
}

function Write-Log($msg) {
  Ensure-LogDir
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Add-Content -Path $LogPath -Value "[$ts] $msg"
}

try {
  Write-Log "START sync job"

  if (!(Test-Path $PasswordFile)) {
    throw "PasswordFile nao encontrado: $PasswordFile"
  }

  $secureText = Get-Content $PasswordFile -Raw
  if (-not $secureText) { throw "PasswordFile vazio: $PasswordFile" }

  $securePwd = $secureText | ConvertTo-SecureString
  $plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
  )

  Write-Log "Login eControle..."
  $loginBody = @{ email=$Email; password=$plainPwd } | ConvertTo-Json
  $tok = (Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body $loginBody -TimeoutSec 60).access_token
  if (-not $tok) { throw "Login nao retornou access_token" }

  Write-Log "POST /certificados/sync ..."
  $headers = @{ Authorization="Bearer $tok"; "X-Org-Slug"=$OrgSlug }

  # sync pode demorar (muitos certificados)
  $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/certificados/sync" -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 900

  $summary = "OK sync: received=$($resp.received) inserted=$($resp.inserted) updated=$($resp.updated) mapped=$($resp.mapped_companies) unmapped=$($resp.unmapped_cnpjs)"
  Write-Log $summary
  exit 0
}
catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  exit 1
}