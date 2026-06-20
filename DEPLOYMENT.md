# 🚀 Guía de Despliegue de Producción - Fuxion Flow CRM

Esta guía detalla los pasos para desplegar **Fuxion Flow CRM** y ponerlo en línea 24/7 de forma gratuita usando **Vercel** para la aplicación y **Supabase** para la base de datos PostgreSQL.

---

## 📋 Requisitos Previos

Necesitas contar con las siguientes credenciales para configurar el entorno de producción:
1. **Base de Datos**: Una cuenta gratuita en [Supabase](https://supabase.com/).
2. **Gemini API Key**: Una clave de API gratuita de [Google AI Studio](https://aistudio.google.com/).
3. **Servicio de Correo (Opcional)**: Credenciales SMTP (como una *Contraseña de Aplicación de Gmail*) o una clave de API de **Resend**.

---

## 🛠️ Paso 1: Configurar la Base de Datos en Supabase

En producción, la base de datos local SQLite (`db.sqlite`) no se puede utilizar en plataformas como Vercel porque el sistema de archivos de Vercel es efímero y de solo lectura. Debes usar **Supabase/PostgreSQL**:

1. Inicia sesión en **Supabase** y crea un **Nuevo Proyecto** (*New Project*).
2. Espera a que la base de datos se inicialice.
3. En el menú lateral izquierdo de Supabase, ve a **SQL Editor**.
4. Haz clic en **New Query** (Nueva Consulta).
5. Abre el archivo local [supabase/schema.sql](file:///d:/NUTRAFLOW%20CRM/supabase/schema.sql), copia todo su contenido y pégalo en el editor de Supabase.
6. Haz clic en el botón **Run** (Ejecutar) en la esquina inferior derecha. Esto creará todas las tablas (`leads`, `flows`, `knowledge_base`, `knowledge_gaps`, `chat_messages`) con sus relaciones.
7. Ve a **Project Settings** (Configuración del Proyecto) $\rightarrow$ **API**.
8. Copia los siguientes valores (los necesitarás para el despliegue):
   * `Project URL` (URL del Proyecto)
   * `anon public` (Clave de API pública)

---

## ⚡ Paso 2: Despliegue en Vercel (Recomendado)

**Vercel** es la plataforma oficial de los creadores de Next.js y ofrece un despliegue en línea 24/7 gratuito y extremadamente rápido.

### Opción A: Despliegue desde GitHub (Recomendado)
1. Sube tu código de Fuxion Flow CRM a un repositorio privado en **GitHub**.
2. Inicia sesión en [Vercel](https://vercel.com/) utilizando tu cuenta de GitHub.
3. Haz clic en **Add New** $\rightarrow$ **Project**.
4. Selecciona tu repositorio de Fuxion Flow CRM e impórtalo (*Import*).
5. En la sección **Environment Variables** (Variables de Entorno), agrega las variables declaradas en [.env.example](file:///d:/NUTRAFLOW%20CRM/.env.example):
   * `NEXT_PUBLIC_SUPABASE_URL` = (Tu URL de Supabase)
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (Tu clave pública anon de Supabase)
   * `GEMINI_API_KEY` = (Tu clave de Google Gemini)
   * `SMTP_HOST` = (Tu servidor SMTP, ej. `smtp.gmail.com`)
   * `SMTP_PORT` = `587` (o `465`)
   * `SMTP_USER` = (Tu dirección de correo de alertas)
   * `SMTP_PASS` = (Tu contraseña de aplicación)
   * `SMTP_FROM` = (Tu nombre de remitente ej: `Fuxion Flow CRM <tu-correo@dominio.com>`)
   * `ADMIN_EMAIL` = (Tu correo personal para recibir las notificaciones de Modo Manual y pagos)
6. Haz clic en **Deploy** (Desplegar).
7. ¡Listo! Vercel te entregará una URL pública segura (`https://tu-proyecto.vercel.app`) donde tu CRM estará activo las 24 horas del día.

### Opción B: Despliegue usando Vercel CLI
1. Abre tu terminal e instala la CLI de Vercel de forma global:
   ```bash
   npm i -g vercel
   ```
2. Ejecuta el comando de login e inicia sesión:
   ```bash
   vercel login
   ```
3. Desde la raíz de la carpeta del proyecto (`d:\NUTRAFLOW CRM`), ejecuta:
   ```bash
   vercel
   ```
   Sigue las instrucciones en la consola para enlazar el proyecto y configurar tus variables de entorno.
4. Para el despliegue final a producción, ejecuta:
   ```bash
   vercel --prod
   ```

---

## 🚆 Paso 3: Despliegue Alternativo en Railway

Si prefieres desplegar el servidor en **Railway**:
1. Crea una cuenta en [Railway.app](https://railway.app/).
2. Haz clic en **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Elige tu repositorio y haz clic en **Deploy Now**.
4. Una vez empiece la construcción, ve a la pestaña **Variables** del servicio en Railway y haz clic en **Raw Editor** para pegar los valores de tu archivo `.env`.
5. En **Settings**, haz clic en **Generate Domain** para obtener una URL pública de acceso.
