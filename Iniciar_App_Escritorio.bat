@echo off
title ASISTENTE VIRTUAL - NUTRAFLOW CRM (App de Escritorio)
color 0B
echo ========================================================
echo     ASISTENTE VIRTUAL - NUTRAFLOW CRM (Desktop)
echo ========================================================
echo.
echo [1/2] Levantando servicios locales...
start /b cmd /c "npm run dev"

echo [2/2] Esperando conexion...
powershell -Command "for ($i=0; $i -lt 40; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { break } } catch { Start-Sleep -Seconds 1 } }"

echo Abriendo ventana de la Aplicacion...
npx electron .

exit
