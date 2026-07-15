# Auditoría de Proyecto - Fuxion Flow CRM

Este documento contiene un resumen completo de la estructura, base de datos, rutas API, seguridad y comentarios pendientes del proyecto **Fuxion Flow CRM**.

---

## 1. Árbol de Carpetas (Excluyendo `node_modules`, `.next` y `.git`)

```
Fuxion Flow CRM/
├── app/                        # Aplicación Next.js (Rutas y Páginas)
│   ├── api/                    # Directorio de endpoints backend
│   │   ├── auth/               # Endpoints de autenticación (login, logout, registro, etc.)
│   │   │   ├── avatar/
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   ├── me/
│   │   │   └── register/
│   │   ├── broadcast/          # Envío masivo de mensajes
│   │   ├── chat/               # Respuestas de chat y mensajería
│   │   │   └── messages/
│   │   ├── cron/               # Tareas programadas (seguimientos y recordatorios)
│   │   │   ├── followup/
│   │   │   └── reminders/
│   │   ├── env-check/          # Comprobación de variables de entorno
│   │   ├── flows/              # CRUD de flujos de automatización
│   │   ├── knowledge/          # Base de conocimiento (multimedia)
│   │   │   └── gap/            # Detección de dudas sin responder
│   │   ├── leads/              # CRUD de clientes / leads
│   │   ├── notes/              # CRUD de notas internas de clientes
│   │   ├── reminders/          # CRUD de recordatorios
│   │   ├── settings/           # Configuración del sistema
│   │   │   └── configs/
│   │   ├── webhook/            # Webhooks integrados (WhatsApp API / Evolution)
│   │   │   └── whatsapp/
│   │   └── whatsapp/           # Control de sesiones de WhatsApp (Baileys)
│   │       └── send/
│   ├── broadcast/              # Interfaz de envíos masivos
│   │   └── page.tsx
│   ├── flows/                  # Interfaz del editor de flujos (Canvas)
│   │   └── page.tsx
│   ├── login/                  # Página de acceso/login
│   │   └── page.tsx
│   ├── settings/               # Panel de configuraciones
│   │   └── page.tsx
│   ├── whatsapp/               # Interfaz de conexión QR de WhatsApp
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css             # Estilos globales con Tailwind CSS
│   ├── layout.tsx              # Layout general de la aplicación
│   └── page.tsx                # Dashboard principal (chats, leads, dudas)
├── components/
│   └── Sidebar.tsx             # Panel de navegación lateral de la app
├── lib/                        # Lógica core, servicios externos y base de datos
│   ├── auth-utils.ts           # Encriptación de contraseñas y firma de tokens JWT
│   ├── db.ts                   # Adaptador de base de datos (SQLite local / Supabase fallback)
│   ├── gemini.ts               # Integración con Google Gemini AI
│   ├── notifications.ts        # Control de alertas y avisos
│   ├── supabase-browser.ts     # Cliente del navegador para Supabase
│   ├── whatsapp-auth-store.ts  # Almacén de credenciales para el cliente de WhatsApp
│   ├── whatsapp-sender.ts      # Funciones auxiliares de envío
│   └── whatsapp-service.ts     # Servicio principal de Baileys para control de sesiones
├── public/                     # Archivos estáticos y subidas
│   └── uploads/                # Archivos PDF, TXT, Imágenes cargados en la Base de Conocimiento
├── scripts/                    # Scripts utilitarios y de diagnóstico
│   ├── check-env.js
│   ├── monitor-evolution-api.js
│   ├── poll-whatsapp.js
│   └── test-supabase.js
├── supabase/                   # Archivos relacionados con Supabase
│   └── schema.sql              # Definición de tablas y esquema de la base de datos
└── whatsapp_auth/              # Sesión activa de Baileys (credenciales guardadas localmente)
```

---

## 2. Lista de Tablas de la Base de Datos y Columnas (`supabase/schema.sql`)

### `leads`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador único del cliente |
| `name` | TEXT | | Nombre del cliente |
| `phone` | TEXT | UNIQUE NOT NULL | Número de teléfono de WhatsApp |
| `whatsapp_lid` | TEXT | | Identificador local de WhatsApp |
| `status` | TEXT | NOT NULL DEFAULT 'New' | Estado ('New', 'Engaged', 'Pending Verification', 'Converted') |
| `tags` | TEXT | NOT NULL DEFAULT '[]' | Etiquetas asociadas (JSON en texto: `["caliente", "seguimiento"]`) |
| `bot_active` | INTEGER | NOT NULL DEFAULT 1 | Estado del chatbot (1 = activo, 0 = inactivo/modo sombra) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación del registro |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de última actualización |

### `flows`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador único del flujo |
| `name` | TEXT | NOT NULL | Nombre del flujo |
| `nodes` | TEXT | NOT NULL | Estructura de nodos (JSON serializado) |
| `edges` | TEXT | NOT NULL | Estructura de conexiones (JSON serializado) |
| `is_active` | INTEGER | NOT NULL DEFAULT 0 | 1 si está publicado y activo, 0 si no |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Última actualización |

### `knowledge_base`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador único del recurso |
| `title` | TEXT | NOT NULL | Título del archivo o contenido |
| `file_type` | TEXT | NOT NULL | Tipo ('pdf', 'txt', 'image', 'mp4') |
| `content` | TEXT | | Contenido de texto extraído |
| `summary` | TEXT | | Resumen automatizado generado por el modelo de IA |
| `file_path` | TEXT | | Ruta del archivo en almacenamiento |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |

### `knowledge_gaps`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador de la duda no resuelta |
| `lead_id` | TEXT | REFERENCES `leads(id)` | Cliente asociado al cual no se le pudo responder |
| `question` | TEXT | NOT NULL | Pregunta realizada por el cliente |
| `context` | TEXT | | Contexto o historial reciente del chat |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | Estado ('pending', 'resolved') |
| `answer` | TEXT | | Respuesta proporcionada por el administrador |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha del percance |
| `resolved_at` | TIMESTAMP | | Fecha en que se solucionó |

### `chat_messages`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador del mensaje |
| `lead_id` | TEXT | NOT NULL REFERENCES `leads(id)` | Cliente asociado |
| `sender` | TEXT | NOT NULL | Remitente ('customer', 'bot', 'agent') |
| `message` | TEXT | NOT NULL | Texto del mensaje |
| `is_read` | BOOLEAN | NOT NULL DEFAULT false | Estado de lectura por el agente |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de envío |

### `whatsapp_sessions`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador de sesión |
| `creds` | JSONB | | Credenciales de Baileys |
| `keys` | JSONB | | Llaves de encriptación de Baileys |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de actualización |

### `lead_notes`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador de la nota |
| `lead_id` | TEXT | NOT NULL REFERENCES `leads(id)` | Cliente asociado |
| `content` | TEXT | NOT NULL | Texto de la nota interna |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de anotación |

### `reminders`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador del recordatorio |
| `lead_id` | TEXT | NOT NULL REFERENCES `leads(id)` | Cliente asociado |
| `message` | TEXT | NOT NULL | Mensaje a enviar/recordar |
| `scheduled_at` | TIMESTAMP | NOT NULL | Fecha y hora programada |
| `sent` | INTEGER | NOT NULL DEFAULT 0 | Estado de envío (0 = pendiente, 1 = enviado) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |

### `system_settings`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `key` | TEXT | PRIMARY KEY | Nombre de la configuración clave |
| `value` | TEXT | | Valor en formato texto |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de actualización |

### `broadcasts`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador de difusión masiva |
| `name` | TEXT | NOT NULL | Nombre de la campaña masiva |
| `message` | TEXT | NOT NULL | Mensaje general a enviar |
| `targets` | JSONB | | Segmento/Filtro de números destinatarios |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | Estado ('pending', 'processing', 'completed', 'failed') |
| `sent_count` | INTEGER | NOT NULL DEFAULT 0 | Mensajes enviados con éxito |
| `failed_count` | INTEGER | NOT NULL DEFAULT 0 | Mensajes fallidos |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de registro |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de actualización |

### `users`
| Columna | Tipo | Restricción / Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Identificador único de usuario del panel |
| `email` | TEXT | UNIQUE NOT NULL | Correo electrónico de acceso |
| `password` | TEXT | NOT NULL | Contraseña hasheada |
| `name` | TEXT | DEFAULT '' | Nombre de pila |
| `avatar_url` | TEXT | DEFAULT '' | URL de imagen de perfil |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |

---

## 3. Lista de Rutas API / Endpoints

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| **POST** | `/api/auth/avatar` | Actualiza la imagen de perfil / avatar del usuario logueado. |
| **POST** | `/api/auth/login` | Inicia sesión del usuario y genera la cookie de sesión cifrada. |
| **POST** | `/api/auth/logout` | Cierra la sesión activa removiendo la cookie. |
| **GET** | `/api/auth/me` | Retorna el perfil y los datos del usuario actualmente autenticado. |
| **POST** | `/api/auth/register` | Crea y registra un nuevo usuario en la base de datos. |
| **GET** | `/api/broadcast` | Obtiene el listado de campañas de envío masivo. |
| **POST** | `/api/broadcast` | Registra e inicia una nueva campaña de envío masivo. |
| **POST** | `/api/chat` | Endpoint para el motor de procesamiento de chats (análisis de IA o derivaciones). |
| **GET** | `/api/chat/messages` | Obtiene el historial de mensajes de chat de un cliente específico. |
| **POST** | `/api/chat/messages` | Agrega un nuevo mensaje de chat al historial. |
| **PUT** | `/api/chat/messages` | Actualiza estados de los mensajes (ej. marcar como leído). |
| **DELETE** | `/api/chat/messages` | Elimina mensajes o historiales completos. |
| **GET** | `/api/cron/followup` | Comprobación o ejecución de tareas programadas de seguimiento. |
| **POST** | `/api/cron/followup` | Dispara el envío de mensajes de seguimiento automáticos. |
| **GET** | `/api/cron/reminders` | Comprobación o ejecución de recordatorios programados en lote. |
| **POST** | `/api/cron/reminders` | Envía los recordatorios que están programados a la hora actual. |
| **GET** | `/api/env-check` | Endpoint de diagnóstico de salud del entorno y variables del sistema. |
| **GET** | `/api/flows` | Obtiene el listado de flujos de automatización configurados. |
| **POST** | `/api/flows` | Guarda o actualiza un flujo de automatización (diseño de nodos). |
| **GET** | `/api/knowledge` | Obtiene la lista de documentos cargados en la base de conocimiento. |
| **POST** | `/api/knowledge` | Sube documentos nuevos y procesa/resume su texto mediante IA. |
| **DELETE** | `/api/knowledge` | Elimina documentos de la base de conocimiento. |
| **GET** | `/api/knowledge/gap` | Lista las dudas sin responder detectadas en modo sombra. |
| **POST** | `/api/knowledge/gap` | Resuelve una duda entrenando a la base de datos con la respuesta del agente. |
| **DELETE** | `/api/knowledge/gap` | Descarta/Elimina una duda sin responder de la lista. |
| **GET** | `/api/leads` | Obtiene el listado completo de leads o filtrados por estado. |
| **POST** | `/api/leads` | Crea o actualiza un cliente / lead. |
| **DELETE** | `/api/leads` | Elimina un lead de la base de datos. |
| **GET** | `/api/notes` | Obtiene las notas internas guardadas sobre un lead. |
| **POST** | `/api/notes` | Añade una nota interna sobre el lead. |
| **DELETE** | `/api/notes` | Elimina una nota interna específica. |
| **GET** | `/api/reminders` | Obtiene la lista de recordatorios activos/programados. |
| **POST** | `/api/reminders` | Añade un nuevo recordatorio programado. |
| **DELETE** | `/api/reminders` | Cancela/Elimina un recordatorio pendiente. |
| **GET** | `/api/settings` | Obtiene las configuraciones básicas del sistema. |
| **POST** | `/api/settings` | Guarda configuraciones básicas del sistema. |
| **GET** | `/api/settings/configs` | Obtiene configuraciones avanzadas del backend. |
| **POST** | `/api/settings/configs` | Guarda configuraciones avanzadas del backend. |
| **GET** | `/api/webhook/whatsapp` | Endpoint de verificación del webhook externo (Evolution/Meta). |
| **POST** | `/api/webhook/whatsapp` | Procesa los eventos de mensajes entrantes desde el webhook externo. |
| **GET** | `/api/whatsapp` | Obtiene el estado actual de la sesión local QR de Baileys. |
| **POST** | `/api/whatsapp` | Inicializa, reconecta o destruye la sesión QR de WhatsApp local. |
| **POST** | `/api/whatsapp/send` | Envía un mensaje manual por WhatsApp usando la sesión activa. |

---

## 4. Roles y Permisos Actuales

Actualmente, **no existe un sistema de Control de Acceso Basado en Roles (RBAC/ABAC)** implementado en el sistema.

* **Esquema de Usuarios:** La tabla `users` contiene únicamente credenciales básicas de acceso (`id`, `email`, `password`, `name`, `avatar_url`, `created_at`). No contiene una columna `role` o `permissions`.
* **Seguridad en Endpoints:** Todos los endpoints protegidos se limitan a verificar que exista un token de sesión válido emitido por la aplicación (`userId` y `email`). Cualquier usuario autenticado tiene permisos totales e ilimitados de lectura y escritura en todas las secciones del sistema (Leads, Configuración, Chats, Flujos, Base de Conocimiento, etc.).

---

## 5. Lista de TODOs y FIXMEs

* No se encontraron comentarios explícitos marcados como `TODO` o `FIXME` en los archivos de código fuente de la aplicación (`.ts`, `.tsx`, `.js`, `.jsx`).
