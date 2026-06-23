@echo off
title EduPath Launcher
echo =========================================================
echo               LAUNCHING EDUPATH PLATFORM
echo =========================================================
echo.
echo [1/2] Lancement du serveur Backend sur le port 5000...
start cmd /k "title EduPath Backend && cd backend && npm start"

echo [2/2] Lancement du serveur Frontend (Vite) sur le port 5173...
start cmd /k "title EduPath Frontend && cd frontend && npm run dev"

echo.
echo =========================================================
echo EduPath est pret!
echo.
echo URL Backend : http://localhost:5000
echo URL Frontend: http://localhost:5173
echo =========================================================
pause
