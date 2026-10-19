@echo off
cd /d "%~dp0"
title Agent Canvas - connexion GitHub, a faire une seule fois
echo ============================================================
echo   Connexion de ce PC a ton compte GitHub - une seule fois
echo ============================================================
set "PATH=%PATH%;%ProgramFiles%\GitHub CLI;%LOCALAPPDATA%\Programs\GitHub CLI"
where gh >nul 2>nul
if not errorlevel 1 goto login

echo Installation de GitHub CLI - outil officiel de GitHub, environ 15 Mo...
echo Si Windows demande une autorisation, clique sur Oui.
winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
where gh >nul 2>nul
if not errorlevel 1 goto login
echo.
echo GitHub CLI n'a pas pu etre installe. Installe-le depuis https://cli.github.com puis relance ce fichier.
echo FAIL> connexion-github.result
pause
exit /b 1

:login
echo.
echo Une page GitHub va s'ouvrir : colle le code affiche ci-dessous, puis valide.
echo.
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status >nul 2>nul
if errorlevel 1 goto notlogged
echo OK> connexion-github.result
echo.
echo C'est fait ! Tu peux fermer cette fenetre.
timeout /t 8 >nul
exit /b 0

:notlogged
echo FAIL> connexion-github.result
echo La connexion n'a pas abouti. Relance ce fichier pour reessayer.
pause
exit /b 1
