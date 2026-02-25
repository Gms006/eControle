param(
  [string]$Email = $env:ECONTROLE_EMAIL,
  [string]$Password = $env:ECONTROLE_PASSWORD
)

$ErrorActionPreference = "Stop"

Write-Host "==> Forcing terminal UTF-8 (Windows)"
chcp 65001 | Out-Null
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()

$baseUrl = "http://localhost:8020"
$jsonPath = Join-Path $PSScriptRoot "datasets\companies_example.json"

if (-not $Email -or -not $Password) {
  throw "Missing credentials. Set ECONTROLE_EMAIL and ECONTROLE_PASSWORD env vars or pass -Email/-Password."
}

Write-Host "==> Login and getting token"
$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/login" `
  -ContentType "application/json; charset=utf-8" `
  -Body (@{ email=$Email; password=$Password } | ConvertTo-Json -Compress)
$token = $login.access_token

Write-Host "==> Running ingest 1x"
# Read as UTF-8 explicitly to avoid mojibake on Windows PowerShell
$body = [System.IO.File]::ReadAllText($jsonPath, [System.Text.UTF8Encoding]::new($false))
$r1 = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/ingest/run" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
$r1 | ConvertTo-Json -Depth 10

Write-Host "==> Running ingest 2x (idempotent)"
$r2 = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/ingest/run" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
$r2 | ConvertTo-Json -Depth 10

Write-Host "==> OK"
