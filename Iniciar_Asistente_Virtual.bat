@echo off
title ASISTENTE VIRTUAL - NUTRAFLOW CRM
color 0B
echo ========================================================
echo     ASISTENTE VIRTUAL - NUTRAFLOW CRM
echo ========================================================
echo.
echo [1/2] Iniciando servidor de Next.js...
start /b cmd /c "npm run dev"

echo [2/2] Esperando que el servidor este listo...
powershell -Command "for ($i=0; $i -lt 40; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { break } } catch { Start-Sleep -Seconds 1 } }"

echo.
echo Abriendo NutraFlow CRM en tu navegador...
start http://localhost:3000

echo.
echo ========================================================
echo Servidor ACTIVO en: http://localhost:3000
echo Manten esta ventana abierta mientras uses el sistema.
echo Para apagar el servidor, cierra esta ventana.
echo ========================================================
pause

