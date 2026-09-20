# Registro de cambios — NUTRAFLOW CRM (modo local + Baileys QR)

Entorno: Windows, Node 26, `npm run dev` en `http://localhost:3000`, SQLite (`%APPDATA%/NutraFlow CRM/db.sqlite`), Baileys QR. Sin Electron en esta etapa.

Última actualización: 2026-09-10.

## Bloque 1 — Auth y secretos (crítico)
- Nuevo `lib/api-auth.ts`: `requireSession` (cookie `auth_token`), `isCronAuthorized` (sesión o `CRON_API_KEY`, sin fallback público), máscaras de secretos.
- Sesión exigida en: `whatsapp`, `whatsapp/send`, `broadcast`, `settings/configs`, `cron/status`, `cron/reminders`, `cron/followup`, `ai/test-key`, `whatsapp/status`, `status/library`, `leads`, `notes`, `reminders`, `flows`, `chat`, `chat/messages`, `knowledge`, `knowledge/gap`, `ai-rules`, `settings/test-email`, `env-check`, `upload`, `upload/status`.
- `settings/configs` GET ya no expone secretos (máscara + flags); POST preserva secretos y fusiona `ai_api_keys` por id. Frontend adaptado.
- Webhook WhatsApp: verify sin fallback hardcoded, firma Meta opcional, token de webhook exigible. Webhooks FB/IG con el mismo patrón.
- `proxy.ts`: auto-login solo en localhost; en red externa redirige a `/login`.
- `.env.example` con `JWT_SECRET`, `AUTH_SALT`, `CRON_API_KEY`, `WHATSAPP_VERIFY_TOKEN`, `EVOLUTION_WEBHOOK_TOKEN`, `WHATSAPP_APP_SECRET`.
- `JWT_SECRET` + `AUTH_SALT` generados e instalados en `.env.local` (0 usuarios, sin impacto).

## Bloque 2 — Base de datos
- `better-sqlite3` recompilado para Node 26 (causa del `Cannot read properties of null`).
- `getSqliteDb()` lanza error legible; `getSqliteDbOrNull()` para los 22 sitios con guard; `PRAGMA foreign_keys = ON`; `getDatabaseStatus()`.
- Transacciones en `mergeLeads`, `setActiveFlow` (rechaza IDs fantasma), `deleteLead` (+ notas y recordatorios).
- `getLeads` no mezcla datos locales con 0 legítimo de nube; `safeParseTags`/`safeParseJson` en leads, flows, broadcasts.
- Columna `real_phone` (SQLite + `supabase/schema.sql`); `upsertLead` la persiste; `mergeLeads` la preserva.
- `supabase/schema.sql`: agregadas `ai_rules`, `whatsapp_status_library`, `whatsapp_status_schedules`; publicación Realtime idempotente.
- Backup automático: al arrancar + cada 24h en `%APPDATA%/NutraFlow CRM/backups` (últimos 7) + `POST /api/settings/backup`.

## Números reales (LID)
- Regla global: LID = 14+ dígitos (salvo `whatsapp_lid` contaminado <14, que se ignora); móviles AR de 13 son reales.
- Auto-resolución: `senderPn`, contactos (`rememberLidMapping`), nombre, fusiones; `real_phone` se persiste al resolverse.
- Cabecera del chat: número completo sin recorte, clic para copiar, ✏️ para asignar/corregir (antes muerto, ahora guarda en BD).
- Tráfico propio excluido (el número vinculado ya no se crea como lead).
- Sheets: columna C con número real + columnas I (Canal), J (No leídos), K (LID).

## Estabilidad WhatsApp
- Códigos terminales 401/403/500 → estado `logged_out` sin loop; ruta devuelve 409 hasta revincular.
- Generación anti sockets-duplicados; limpieza de listeners + `end()` del socket viejo; fin del timer de 1s con carrera.
- `getQrDataUrl` con errores descriptivos.

## Broadcast y estados
- Validación + tope 500 + estado `failed` ante error fatal.
- Pestaña **Elegir**: checklist de contactos + números manuales internacionales (`tel:`,respeta código país, alta automática con tag `broadcast`).
- JID explícito por contacto (`@lid` vs `@s.whatsapp.net`); `sendMessageToPhone` resuelve `/uploads/` y `data:` a Buffer.
- `mediaUrl` acepta `https` o `/uploads/` (incluye `status/`); `/api/upload` con auth, allowlist y 10MB.
- Estados: propio JID siempre incluido + error claro si falta el archivo + `messageId` en respuesta.

## Leads y Kanban
- `LEAD_STATUSES` + whitelist en `upsertLead` y `POST /api/leads`; columna **Archivados**; `Archived` traducido.
- Fusión auto solo por identificadores exactos (throttle 1/min); regla por nombre eliminada; fusión manual en panel + `POST /api/leads/merge`.
- Lista ordenada por actividad (sort estable) + polling local 3s siempre (antes se congelaba con cliente Supabase presente).

## IA y conocimiento
- RAG blindado contra base64: `stripMediaBlobs`, `safeWordRegex`, historial topado a 800 chars (antes un `RegExp` gigante mataba respuestas, ej. caso Carlos Oblitas).
- Reglas núcleo `rule-1/2/3` no eliminables; respuestas de gaps topadas a 1000 chars.

## Google Sheets
- Modos full/delta/rebuild, `last_sync`, lectura de `created/updated` del script, vía visible (`api`/`webhook`).
- API oficial por cuenta de servicio (`lib/google-sheets-api.ts`, auto con fallback a webhook); campos ID + JSON en Configuración.
- Apps Script con upsert por ID + `rebuild` + `eliminarDuplicados` (vive en la cuenta de Google, no en el repo).
- **Verificado 2026-09-10: sincronización completa vía API oficial (0 nuevos · 9 actualizados), sin duplicados.**

## Limpieza modo local
- Fuera: Realtime frontend, `supabase-browser.ts`, `whatsapp-auth-store.ts`, ramas Meta/Evolution del sender y crons, storage Supabase en uploads/knowledge, `getSupabaseClient` del webhook.
- Se mantiene dual a propósito: ramas `useSupabase` en `lib/db.ts`, dependencia `@supabase/supabase-js`, carpeta `supabase/`, webhooks FB/IG (dormidos).

## Licencias v2 (auto-vinculación, 2026-09-10)
- Fuera: seriales `NF-*`, `ADMIN_ONLY_GENERATOR/`, `MASTER_SECRET`, bypass de localStorage, modal de activación manual.
- `lib/license.ts`: huella HW v2 (placa→disco→hostname/CPU), install-ID auto, `ensureActivated()` (candado local + check-in remoto con gracia), `releaseHardwareBinding()`.
- `POST /api/license/activate`: acciones `set-company` (sella marca), `release`, `checkin`. GET con estado completo.
- Enforcement real: `requireActiveLicense()` en broadcast, whatsapp/send, ai/test-key, ai/test-stored (402 `LICENSE_BLOCKED`); lectura abierta.
- `ActivationModal` → pantalla de estado (sin claves, sin gracia visible); Sidebar sin bypass.
- `license-server/` referencia verificada (checkin/list/block) + `MANUAL_LICENCIAS.md`. Gracia por días y servidor central: pendientes de despliegue.
- `electron-builder.json` con `asar: true`; `.env.example` con `LICENSE_SERVER_URL` y `LICENSE_VENDOR_CONTACT`.

## Limpieza redundancias (2026-09-10)
- Nuevos `lib/lead-utils.ts` (teléfonos, estados, scoring) y `lib/webhook-auth.ts` (firma/verify); consumidos por página, 3 vistas, webhook WA/FB/IG y sender.
- Eliminados 15 scripts muertos/peligrosos de `scripts/` (parches `bulletproof-*`, `fix-db-*`, `*-triple-db*`, `wire-up-*`, `sync-supabase-*`, etc.). Quedan 23 utilitarios (seeds, iconos, monitores).
- Eliminados `calculateScore`/`getScoreColor` huérfanos en `app/page.tsx`.

## Limpieza distribución (2026-09-10)
- Instalador ya NO incluye: `.env.local`/`.env` (¡llevaba tus API keys!), `db.sqlite*`, `dev.log`, `.kilo/` (56MB), `scratch/`, `public/uploads/` (32MB con tus imágenes y PII), `license-server/installations.json`, jpgs de referencia, `installer_splash.png` (sin uso).
- Borrados del árbol: `.next/`, `dev.log`, `tsconfig.tsbuildinfo`, 3 imágenes de referencia sin uso, `dist/` anterior (972MB).
- `.gitignore`: `dev.log`, `*.log`, `public/uploads/`, `scratch/`.
- Excluidos del empaquetado (siguen en repo): `*.md`, configs dev (eslint/postcss/tsconfig/Docker), `scripts/`, `supabase/`, `license-server/`, `MANUAL_OFICIAL*.html`.
- NO tocado: `.kilo/` (otro agente), `node_modules`, datos locales (`.env.local`, `db.sqlite`, uploads se quedan en tu PC).

## Pendientes conocidos
- Probar Baileys 7.x final cuando salga (mejor `lidMapping`); hoy 6.7.24 (última estable).
- `IDENTITY_MAPPING` con 2 números en código → mover a configuración.
- Toast de error al fallar drag-and-drop en Kanban.
- `CRON_API_KEY` sin definir (solo importa si se expone a internet).
- `dev.log` y `public/uploads` sin ignorar en git; `db.sqlite` trackeado.
- Sin tests automatizados.
