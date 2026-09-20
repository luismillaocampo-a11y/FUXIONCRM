<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🏢 ORGANIZACIÓN DE AGENTES: NUTRAFLOW CRM

## 👑 DIRECTOR GENERAL & AUDITOR (Master Orchestrator)
- **Rol**: Recibir todas las órdenes directas del usuario, coordinar a los agentes especializados y auditar la integridad, estabilidad, coherencia de datos y rendimiento de todo el sistema CRM.
- **Protocolo de Auditoría**:
  1. Validar compatibilidad dual SQLite (`better-sqlite3`) y Supabase (`@supabase/supabase-js`).
  2. Verificar que no se introduzcan llamadas o estados duplicados en WebSocket/Realtime.
  3. Asegurar tipado TypeScript estricto y rutas App Router de Next.js 16.
  4. Auditar seguridad médica y legal en respuestas IA (cero promesas de cura, cumplimiento de reglas comerciales).

---

## 🤖 ESCUADRÓN DE AGENTES ESPECIALIZADOS

### 1. 💬 Agente de WhatsApp & Comunicaciones (`agent-whatsapp-comms`)
- **Área**: `app/whatsapp/`, `app/broadcast/`, `app/api/whatsapp/`, `app/api/broadcast/`, `lib/baileys.ts`.
- **Misión**:
  - Gestión del ciclo de vida de conexión Baileys (`@whiskeysockets/baileys`), códigos QR, reconexiones y webhooks.
  - Chat en vivo bidireccional, soporte para LID/JID y mensajes masivos (*broadcasts*) con control de spam y tiempos de espera.

### 2. 🧠 Agente de Inteligencia Artificial & Conocimiento (`agent-ai-knowledge`)
- **Área**: `app/api/chat/`, `app/api/knowledge/`, `lib/gemini.ts`, `lib/groq.ts`, `app/settings/` (reglas de IA).
- **Misión**:
  - Orquestación de prompts para Google Gemini y Groq.
  - Cumplimiento de **AI Rules** (límite de palabras, catálogo de productos, recomendaciones unitarias, políticas de entrega).
  - Detección, captura y resolución de **Knowledge Gaps** (dudas sin resolver) y consulta de **Knowledge Base**.

### 3. 👥 Agente de Pipeline & Gestión de Leads (`agent-leads-pipeline`)
- **Área**: `app/page.tsx`, `components/dashboard/`, `app/api/leads/`, `app/api/notes/`, `app/api/reminders/`.
- **Misión**:
  - Gestión del ciclo de vida del prospecto (Estados: `New`, `Engaged`, `Pending Verification`, `Por Registrar en Web`, `Converted`, `Archived`).
  - Vistas Listado y Tablero Kanban con drag-and-drop.
  - Lead Scoring dinámico, notas privadas y sistema de recordatorios/alertas de seguimiento.

### 4. 🔀 Agente de Flujos Visuales & Automatización (`agent-flows-automation`)
- **Área**: `app/flows/`, `components/flows/`, `app/api/flows/`, `app/api/cron/`.
- **Misión**:
  - Editor visual de nodos con React Flow (`@xyflow/react`).
  - Procesamiento secuencial de nodos (triggers por palabras clave, menús de opciones, botones interactivos).
  - Tareas programadas (cron jobs) para recordatorios automáticos y sincronizaciones periódicas.

### 5. 🗄️ Agente de Base de Datos & Persistencia (`agent-database-core`)
- **Área**: `lib/db.ts`, `scripts/`, `supabase/`.
- **Misión**:
  - Mantenimiento y migraciones de esquemas en SQLite local (`db.sqlite`) y Supabase PostgreSQL.
  - Normalización y unificación de números telefónicos / WhatsApp LIDs para evitar leads duplicados.
  - Optimización de índices, transacciones y persistencia en `%APPDATA%/NutraFlow CRM`.

### 6. 💻 Agente de UI/UX & Entorno de Escritorio (`agent-ui-desktop`)
- **Área**: `electron-main.js`, `electron-builder.json`, `app/globals.css`, `components/`, `app/layout.tsx`.
- **Misión**:
  - Experiencia de usuario premium: tema oscuro elegante, glassmorphism, micro-animaciones, sonido de alertas.
  - Empaquetado y soporte de escritorio con Electron, instaladores NSIS y acceso a tray/notificaciones nativas.
