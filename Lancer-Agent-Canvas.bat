@echo off
title Agent Canvas - Multi-AI Studio
cd /d "%~dp0"

echo ========================================================
echo   AGENT CANVAS - Multi-AI Studio Desktop
echo   Mode CLI Natif : Claude Code, Gemini CLI, Ollama, Codex...
echo   (Vos comptes et abonnements sont directement utilises sans cle API)
echo ========================================================
echo.
echo   [1] Lancer l'App Desktop Locale (Vrais CLI & Vos Abonnements - Defaut)
echo   [2] Ouvrir la version Web Cloudflare (Navigateur)
echo ========================================================
choice /c 12 /n /t 3 /d 1 /m "Lancement automatique de l'App Desktop [1] dans 3s (ou 2 pour le Web) : "

if errorlevel 2 (
  start "" "https://agent-canvas.pages.dev"
  exit /b 0
)

echo.
echo Demarrage d'Agent Canvas Desktop...
npm run dev
