# Manual de Licencias — NUTRAFLOW CRM (auto-vinculación, sin seriales)

## Cómo funciona (proceso)
1. **Instalación**: el cliente instala y abre el CRM. Sin pedirle nada, el sistema crea un **ID de instalación** único y lo **vincula al hardware** de esa PC (placa base → disco → hostname+CPU, en ese orden).
2. **Primer uso**: aparece una pantalla que pide solo el **nombre de la empresa** (una vez, queda sellado). Desde ahí todo funciona.
3. **Uso diario**: cada arranque verifica en silencio que el hardware coincida. Si coincide, entra directo. No hay claves que perder ni generador que operar.
4. **Si copian la carpeta a otra PC**: al arrancar detecta hardware distinto y muestra **bloqueo** con el ID de instalación + contacto del proveedor. Los envíos (difusión, WhatsApp, pruebas IA) devuelven `LICENSE_BLOCKED`; la lectura sigue abierta para no perder datos.
5. **Cambio legítimo de PC**: el proveedor libera el amarre (ver "Tareas del proveedor") y la app se revincula sola al siguiente arranque.

## Tareas del proveedor (tú)
- **Ver el ID de instalación de un cliente**: lo muestra su pantalla de licencia (botón copiar) o `GET /api/license/activate`.
- **Liberar amarre (cambio de PC)**: `POST /api/license/activate` con sesión y cuerpo `{"action":"release"}`. Al siguiente arranque se vincula al equipo nuevo.
- **Forzar verificación**: `POST /api/license/activate` con `{"action":"checkin"}`.
- **Marca**: el nombre de empresa se sella al registrarse (`company_name_locked`); el crédito "Desarrollado por L. Milla" se mantiene en branding.
- **Respaldo de seguridad**: los backups diarios (`%APPDATA%/NutraFlow CRM/backups`) incluyen la licencia; al restaurar en la MISMA pc sigue válida; en OTRA pc pide reactivación (correcto).

## Servidor de licencias (para después, opcional)
Hoy el candado es solo local. Cuando quieras control central (ver instalaciones, bloquear a distancia, planes):
1. Despliega `license-server/server.cjs` donde quieras (`node server.cjs`, puerto `LICENSE_PORT` o 4100; `LICENSE_ADMIN_TOKEN` para administrar).
   Esquema Postgres alternativo en `license-server/schema.sql`.
2. En cada CRM define `LICENSE_SERVER_URL=https://tu-servidor/api/checkin` (o el setting `license_server_url`).
3. Desde entonces cada arranque reporta `{install_id, hwid, app_version, company}` y acata `{status, seats, plan, message}`.
4. Administra con:
   - `GET /api/installations` (header `x-admin-token`) → ver equipos.
   - `POST /api/installations/:id/block` `{"blocked":true|false}` → revocar/rehabilitar.
5. Sin red, el CRM sigue funcionando con el candado local (la gracia con días se activa en esa fase).

### Protocolo check-in (para implementaciones propias)
- Request: `POST {base}/api/checkin` JSON `{install_id, hwid, app_version, company}`.
- Response: `{status:'active'|'blocked', seats, plan, message, server_time}`.

## Límites honestos
- Sin servidor, un técnico con acceso total a su PC podría saltarse el candado (vale para cualquier software local). El candado frena la copia casual, que es el 99% de los casos.
- Empaqueta con `asar:true` y no distribuyas este manual ni el código fuente a clientes.
- La carpeta `ADMIN_ONLY_GENERATOR` y los seriales `NF-*` fueron retirados el 2026-09-10.
