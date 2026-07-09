# Manual de Usuario - Nutraflow CRM 🚀

¡Bienvenido a **Nutraflow CRM**! Este sistema unifica la gestión de tus clientes (Leads), automatizaciones de flujos visuales interactivos y respuestas de Inteligencia Artificial avanzadas mediante WhatsApp.

A continuación, encontrarás una guía completa y detallada para usar y configurar todo el proyecto.

---

## Índice
1. [Introducción al Dashboard](#1-introducción-al-dashboard)
2. [Conexión de WhatsApp (QR Local vs. Meta/Evolution API)](#2-conexión-de-whatsapp)
3. [Gestión de Leads y Chat Multiagente](#3-gestión-de-leads-y-chat-multiagente)
4. [Diseñador de Flujos Visuales (Flows Builder)](#4-diseñador-de-flujos-visuales)
5. [Configuración de Inteligencia Artificial y Base de Conocimientos](#5-configuración-de-ia)
6. [Ajustes de Apariencia y Sistema](#6-ajustes-de-apariencia-y-sistema)

---

## 1. Introducción al Dashboard

Al ingresar al CRM, verás el panel principal donde se consolidan las métricas operativas clave en tiempo real:
- **Total Leads**: Cantidad total de clientes únicos registrados en el sistema.
- **Conversaciones**: Total de chats con mensajes registrados.
- **Sin Responder**: Chats que tienen el último mensaje recibido del cliente pero aún no han sido contestados.
- **IA Activa**: Clientes cuyo chat está siendo controlado de forma automática por la Inteligencia Artificial (Gemini).
- **Gaps de Conocimiento**: Preguntas que hicieron los clientes y que la IA no pudo responder debido a falta de información en la Base de Conocimientos.

---

## 2. Conexión de WhatsApp

El CRM ofrece dos métodos para sincronizar y responder mensajes de WhatsApp:

### Método A: Escaneo de Código QR (Recomendado para inicio rápido)
Sigue estos pasos en la pestaña **WhatsApp**:
1. El sistema generará un código QR en tiempo real en la pantalla.
2. Abre la app de **WhatsApp** en tu teléfono celular.
3. Ve a **Dispositivos vinculados** -> **Vincular un dispositivo**.
4. Escanea el código QR de la pantalla.
5. El sistema cambiará su estado a **Conectado**. Esto ejecutará un servidor de conexión en caliente local (Baileys) que procesará los mensajes al instante.

### Método B: Meta WhatsApp Business API o Evolution API
Si prefieres usar una API externa formal:
1. Ve a **Configuración** -> **Conexión de WhatsApp**.
2. Completa los campos:
   - **URL de la API**: Dirección de Meta (`https://graph.facebook.com`) o de tu Evolution API.
   - **Token de Acceso**: Clave API o Token permanente.
   - **Phone Number ID / Instancia**: El identificador numérico de tu línea.
   - **Webhook Verify Token**: Clave que usarás para validar el envío y recepción del Webhook.
3. Haz clic en **Guardar Ajustes de WhatsApp**.

---

## 3. Gestión de Leads y Chat Multiagente

### La Lista de Leads
En el panel izquierdo verás la lista de contactos ordenada cronológicamente por su última interacción. Puedes:
- Buscar contactos por su nombre o número telefónico.
- Filtrar la lista por etiquetas o estados (*Nuevo*, *Contactado*, *Pendiente*, *Vendido*, *Perdido*).

### La Bandeja de Entrada (Chat)
Al hacer clic en un contacto, se abrirá la interfaz del chat interactivo:
- **Historial de Mensajes**: Muestra en tiempo real quién envió cada mensaje (el Cliente, el Agente de forma manual, o el Bot de Inteligencia Artificial).
- **Simular Cliente**: Interruptor en la parte inferior para simular respuestas del cliente con propósitos de prueba.
- **Control de Modo Manual / Automático**:
  - Si el bot está activo, responderá automáticamente basándose en tus flujos visuales o en la IA.
  - Al escribir y enviar un mensaje manual desde la barra inferior, **el bot se pausará automáticamente** para ese cliente, permitiéndote tomar el control humano de la conversación sin interferencias.
  - Puedes reactivar el bot en cualquier momento haciendo clic en el indicador del estado en el panel superior del chat.

---

## 4. Diseñador de Flujos Visuales (Flows Builder)

En la pestaña **Flujos**, cuentas con un lienzo interactivo de arrastrar y soltar (drag & drop) para estructurar árboles de decisión automatizados:

### Tipos de Nodos Disponibles:
1. **Inicio (Trigger)**: Define qué palabra clave o mensaje inicial activa este flujo (ej: *"hola"*, *"precio"*).
2. **Mensaje de Texto**: Envía un mensaje con soporte para texto enriquecido y emojis.
3. **Nodo de Botones**: Envía un bloque con botones interactivos de WhatsApp para que el cliente elija (ej: *Comprar*, *Soporte*, *Ver catálogo*).
4. **Nodo de Medios (Multimedia)**: Permite adjuntar enlaces o archivos locales de tipo **Imagen (.jpg/.png)**, **Audio (.mp3)**, **Video (.mp4)** o **Documentos (.pdf)**.
5. **Acción de IA (Gemini Override)**: Un nodo especial que le indica al bot pausar los flujos fijos y activar temporalmente a Gemini bajo instrucciones personalizadas (Prompts específicos) para procesar interacciones libres del cliente antes de continuar.

### Creación y Activación:
* Conecta los nodos arrastrando las flechas desde los puertos de salida hacia los puertos de entrada.
* Haz clic en **Guardar Flujo** para salvar la estructura.
* Asegúrate de marcar el flujo como **Activo** para que empiece a responder a los clientes.

---

## 5. Configuración de IA y Base de Conocimientos

El bot utiliza el modelo **Google Gemini** para responder preguntas abiertas de forma inteligente cuando el cliente no está en un flujo de botones rígido.

### Activación de Gemini:
1. Ve a **Configuración** -> **Ajustes de IA**.
2. Pega tu **Google Gemini API Key** (puedes obtener una gratis en [Google AI Studio](https://aistudio.google.com/)).
3. Activa el interruptor de **Respuestas Automáticas de IA**.
4. Haz clic en **Guardar Ajustes de IA**.

### Alimentar la IA (Base de Conocimientos):
En la pestaña de la barra lateral puedes subir archivos para entrenar a tu bot:
- Sube documentos de texto o PDFs con la información de tus productos, precios, políticas de envío y preguntas frecuentes.
- La IA buscará automáticamente en estos archivos para responder a las dudas específicas del cliente en WhatsApp mediante algoritmos RAG (Generación Recuperada por Contexto).

---

## 6. Ajustes de Apariencia y Sistema

### Personalización Visual (Apariencia)
Ve a **Configuración** -> **Apariencia**:
- **Tema**: Alterna entre **Modo Oscuro** (interfaz premium optimizada) y **Modo Claro** (esquema de fondo cyan `#d8ffff` suave altamente legible).
- **Color de Énfasis (Accent Color)**: Elige el color del CRM para los botones activos, bordes y barras de estado entre:
  - *Esmeralda (Fuxion)* (Verde CRM corporativo)
  - *Violeta*
  - *Cobalto*
  - *Ámbar*
  - *Rosa*
- Haz clic en **Aplicar Apariencia** y luego en **Guardar cambios** para persistir la configuración en la base de datos de usuario.

### Servidor SMTP (Envío de Alertas)
Ve a **Configuración** -> **Servidor SMTP**:
- Registra tu servidor de correos (ej: Gmail SMTP en el puerto 587) para recibir notificaciones inmediatas por correo cuando el bot detecte un vacío de conocimiento (pregunta que no supo responder) o cuando un cliente complete su registro en un flujo comercial.
- Configura el **Correo del Administrador** en **Ajustes Generales** para recibir estas alertas.

---

## Mantenimiento y Soporte
- Los datos de configuración se almacenan automáticamente en **Supabase** (en la nube si está configurado el entorno) o en una base de datos local ligera llamada `db.sqlite` en el directorio raíz.
- En caso de reiniciar o migrar el CRM, el archivo `db.sqlite` y la carpeta `whatsapp_auth` contienen las credenciales completas para restaurar la sesión vinculada sin necesidad de volver a escanear el QR.
