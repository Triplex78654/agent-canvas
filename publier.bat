@echo off
setlocal
cd /d "%~dp0"
title Agent Canvas - publier une nouvelle version
set "PATH=%PATH%;%ProgramFiles%\GitHub CLI;%LOCALAPPDATA%\Programs\GitHub CLI"
where gh >nul 2>nul || goto nogh
gh auth status >nul 2>nul || goto nogh

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VER=%%v"
gh release view v%VER% >nul 2>nul
if errorlevel 1 goto publish
echo La version %VER% est deja en ligne : passage a la version suivante...
call npm version patch --no-git-tag-version >nul
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VER=%%v"

:publish

echo ============================================================
echo   Publication d'Agent Canvas %VER%
echo ============================================================
echo [1/5] Installation des dependances et tests automatiques...
call npm install --no-audit --no-fund > publier.log 2>&1 || goto fail
call npm test >> publier.log 2>&1 || goto testfail
echo [2/5] Fabrication de l'installateur (2 a 5 minutes)...
call npm run dist:win >> publier.log 2>&1 || goto fail
echo [3/5] Enregistrement dans git...
git add -A
git commit -q -m "Version %VER%" >nul 2>nul
git push -q >> publier.log 2>&1 || goto fail
echo [4/5] Mise en ligne sur GitHub...
gh release create v%VER% "release\Agent-Canvas-Setup-%VER%.exe" "release\Agent-Canvas-Setup-%VER%.exe.blockmap" "release\latest.yml" --title "Agent Canvas %VER%" --generate-notes --target main >> publier.log 2>&1 || goto fail
echo [5/5] Termine ! Version %VER% en ligne : les utilisateurs la recevront via le bouton "Mises a jour".
echo OK %VER%> publier.result
endlocal
exit /b 0

:testfail
echo Un test automatique a echoue : rien n'a ete publie.
goto fail

:nogh
echo GitHub CLI manquant ou pas connecte : lance d'abord connexion-github.bat
goto fail

:fail
echo.
echo ECHEC de la publication - details dans publier.log
echo FAIL> publier.result
pause
endlocal
exit /b 1
