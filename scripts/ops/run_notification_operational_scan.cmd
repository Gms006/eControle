@echo off
setlocal

set PS=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
set SCRIPT=%~dp0run_notification_operational_scan.ps1

rem Configuracao preferencial por variaveis de ambiente:
rem   ECONTROLE_BASE_URL
rem   ECONTROLE_EMAIL
rem   ECONTROLE_PASSWORD
rem   ECONTROLE_SCAN_TIMEOUT_SECONDS
rem   ECONTROLE_SCAN_POLL_INTERVAL_SECONDS
rem Opcional:
rem   ECONTROLE_SCAN_CONFIG_FILE=C:\ProgramData\eControle\secrets\notification_scan.env

"%PS%" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass ^
  -File "%SCRIPT%" ^
  -ConfigFile "%ECONTROLE_SCAN_CONFIG_FILE%"

exit /b %errorlevel%
