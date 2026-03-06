@echo off
setlocal

set PS=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
set SCRIPT=C:\ProgramData\eControle\ops\certhub_mirror_sync.ps1

"%PS%" -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass ^
  -File "%SCRIPT%" ^
  -BaseUrl "http://localhost:8020/api/v1" ^
  -OrgSlug "neto-contabilidade" ^
  -Email "cadastro@netocontabilidade.com.br" ^
  -PasswordFile "C:\ProgramData\eControle\secrets\econtrole_sync_pwd.txt" ^
  -LogPath "C:\ProgramData\eControle\logs\certhub_mirror_sync.log"

exit /b %errorlevel%
