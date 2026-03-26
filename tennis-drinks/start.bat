@echo off
echo Starte Tennis Getränke App...
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo Login: admin@tennisclub.de / PIN: 1234
echo.

start "Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /nobreak > nul
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Beide Server gestartet. Browser oeffnet in 5 Sekunden...
timeout /t 5 /nobreak > nul
start http://localhost:5173
