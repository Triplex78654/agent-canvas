@echo off
title Installation du raccourci Bureau Agent Canvas...
set APP_URL=https://agent-canvas.pages.dev
set ICON_URL=https://agent-canvas.pages.dev/icon.ico
set APP_DIR=%LOCALAPPDATA%\AgentCanvas
set ICON_PATH=%APP_DIR%\icon.ico

if not exist "%APP_DIR%" mkdir "%APP_DIR%"

:: Telechargement de la vraie icone .ico d'Agent Canvas et creation du vrai raccourci Bureau (.lnk) avec icone personnalisee
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue'; ^
   $appDir = Join-Path $env:LOCALAPPDATA 'AgentCanvas'; ^
   if (!(Test-Path $appDir)) { New-Item -ItemType Directory -Path $appDir -Force | Out-Null }; ^
   $iconPath = Join-Path $appDir 'icon.ico'; ^
   Invoke-WebRequest -Uri '%ICON_URL%' -OutFile $iconPath -UseBasicParsing; ^
   $edgePath = (Get-Command msedge -ErrorAction SilentlyContinue).Source; ^
   if (!$edgePath -and (Test-Path ${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe)) { $edgePath = \"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe\" }; ^
   if (!$edgePath -and (Test-Path $env:ProgramFiles\Microsoft\Edge\Application\msedge.exe)) { $edgePath = \"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe\" }; ^
   $chromePath = (Get-Command chrome -ErrorAction SilentlyContinue).Source; ^
   if (!$chromePath -and (Test-Path $env:ProgramFiles\Google\Chrome\Application\chrome.exe)) { $chromePath = \"$env:ProgramFiles\Google\Chrome\Application\chrome.exe\" }; ^
   $targetExe = if ($edgePath) { $edgePath } elseif ($chromePath) { $chromePath } else { 'explorer.exe' }; ^
   $targetArgs = if ($edgePath -or $chromePath) { '--app=%APP_URL%' } else { '%APP_URL%' }; ^
   $wsh = New-Object -ComObject WScript.Shell; ^
   $desktopPath = [Environment]::GetFolderPath('Desktop'); ^
   $oldUrl = Join-Path $desktopPath 'Agent Canvas.url'; ^
   if (Test-Path $oldUrl) { Remove-Item $oldUrl -Force }; ^
   foreach ($dir in @($desktopPath, [Environment]::GetFolderPath('Programs'))) { ^
     $lnkPath = Join-Path $dir 'Agent Canvas.lnk'; ^
     $lnk = $wsh.CreateShortcut($lnkPath); ^
     $lnk.TargetPath = $targetExe; ^
     $lnk.Arguments = $targetArgs; ^
     $lnk.Description = 'Agent Canvas — Multi-AI Studio'; ^
     if (Test-Path $iconPath) { $lnk.IconLocation = \"$iconPath,0\" }; ^
     $lnk.Save(); ^
   }"

:: Lancement immediat de l'application en mode fenetre native
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "" msedge --app=%APP_URL%
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%APP_URL%
  exit /b 0
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%APP_URL%
  exit /b 0
)

start "" "%APP_URL%"
