# ==============================================================================
# NutraFlow CRM - Dockerfile para Google Cloud Run (Next.js 16 Standalone)
# Configurado para Baileys 24/7 (Soporte de WebSockets, Audio/Video FFmpeg y Stickers WebP)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Dependencias base y compilación de módulos nativos
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
# Paquetes requeridos para compilar módulos C++ (better-sqlite3, sharp) y herramientas nativas
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    git \
    libwebp-dev \
    ffmpeg

WORKDIR /app

# Copiar manifiestos de paquetes
COPY package*.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# 2. Compilación del proyecto Next.js en modo Standalone
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumentos opcionales de build (Next.js inlining de variables públicas)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Compilación de la aplicación en modo Standalone
RUN npm run build

# ------------------------------------------------------------------------------
# 3. Imagen final de ejecución (Runner para Cloud Run 24/7 con Baileys)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Instalar librerías de sistema en tiempo de ejecución para Baileys (SSL, FFmpeg para notas de voz, WebP para stickers)
RUN apk add --no-cache \
    libc6-compat \
    ffmpeg \
    libwebp \
    ca-certificates

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Cloud Run inyecta dinámicamente la variable PORT (por defecto 8080)
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Crear usuario de sistema sin privilegios root por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar archivos públicos estáticos
COPY --from=builder /app/public ./public

# Configurar permisos para la carpeta .next
RUN mkdir .next && chown nextjs:nodejs .next

# Copiar la compilación standalone optimizada
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.env.production ./.env.production

# Asignar usuario no-root
USER nextjs

# Puerto estándar de Google Cloud Run
EXPOSE 8080

# Iniciar servidor Node.js standalone
CMD ["node", "server.js"]