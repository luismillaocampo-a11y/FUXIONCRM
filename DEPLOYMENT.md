# 🚀 Guía de Despliegue de Producción - Fuxion Flow CRM

Esta guía detalla los pasos para desplegar **Fuxion Flow CRM** y ponerlo en línea 24/7 de forma permanente usando **Railway** para la aplicación y **Supabase** para la base de datos persistente.

---

## 📋 Requisitos Previos

Necesitas contar con las siguientes credenciales para configurar el entorno de producción:
1. **Base de Datos**: Una cuenta gratuita en [Supabase](https://supabase.com/).
2. **Gemini API Key**: Una clave de API gratuita de [Google AI Studio](https://aistudio.google.com/).
3. **Servicio de Correo (Opcional)**: Credenciales SMTP (como una *Contraseña de Aplicación de Gmail*).

---

## 🛠️ Paso 1: Configurar la Base de Datos en Supabase

En producción, la base de datos local SQLite (`db.sqlite`) no se puede utilizar de manera confiable en Railway porque el sistema de archivos de Railway es efímero y se borra en cada reinicio o despliegue. Debes usar **Supabase/PostgreSQL**:

1. Inicia sesión en **Supabase** y crea un **Nuevo Proyecto** (*New Project*).
2. Espera a que la base de datos se inicialice.
3. En el menú lateral izquierdo de Supabase, ve a **SQL Editor** y haz clic en **New Query** (Nueva Consulta).
4. Abre el archivo local [supabase/schema.sql](file:///d:/NUTRAFLOW%20CRM/supabase/schema.sql), copia todo su contenido y pégalo en el editor de Supabase.
5. Haz clic en el botón **Run** (Ejecutar) en la esquina inferior derecha. Esto creará todas las tablas (`leads`, `flows`, `knowledge_base`, `knowledge_gaps`, `chat_messages`, y `whatsapp_sessions`) con sus relaciones y llaves correspondientes.
6. Ve a **Project Settings** (Configuración del Proyecto) $\rightarrow$ **API** y copia:
   * `Project URL` (URL del Proyecto)
   * `anon public` (Clave de API pública)

---

## 🚆 Paso 2: Despliegue en Railway

**Railway** es una excelente plataforma para ejecutar aplicaciones Next.js completas con soporte de contenedores Docker 24/7.

### Pasos para el Despliegue:
1. Sube tu código de Fuxion Flow CRM a un repositorio privado en **GitHub**.
2. Crea una cuenta en [Railway.app](https://railway.app/).
3. Haz clic en **New Project** $\rightarrow$ **Deploy from GitHub repo**.
4. Selecciona tu repositorio privado y haz clic en **Deploy Now**.
5. Railway detectará automáticamente tu `Dockerfile` y comenzará el proceso de compilación y empaquetado.
6. Una vez que se inicie el servicio, ve a la pestaña **Variables** en el panel de control de tu servicio en Railway.
7. Haz clic en **Raw Editor** y pega las variables de tu archivo `.env.local` o configúralas individualmente:
   * `NEXT_PUBLIC_SUPABASE_URL` = (Tu URL de Supabase)
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (Tu clave pública anon de Supabase)
   * `GEMINI_API_KEY` = (Tu clave de Google Gemini)
   * `SMTP_HOST` = (Tu servidor SMTP, ej. `smtp.gmail.com`)
   * `SMTP_PORT` = `587` (o `465`)
   * `SMTP_USER` = (Tu dirección de correo de alertas)
   * `SMTP_PASS` = (Tu contraseña de aplicación)
   * `SMTP_FROM` = (Tu nombre de remitente ej: `Fuxion Flow CRM <tu-correo@dominio.com>`)
   * `ADMIN_EMAIL` = (Tu correo personal para recibir las notificaciones de Modo Manual y pagos)
8. Ve a la pestaña **Settings** (Ajustes) en Railway, busca la sección **Environment** $\rightarrow$ **Domains** y haz clic en **Generate Domain** para obtener una dirección web pública segura (HTTPS).

¡Tu aplicación ya estará en línea permanentemente y enlazada de forma segura a Supabase!
