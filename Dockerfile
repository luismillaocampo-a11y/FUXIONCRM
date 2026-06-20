
# Usamos una imagen de Node.js oficial (basada en Debian)
FROM node:20

# 1. Instalamos las herramientas necesarias para compilar librerías nativas
# Esto es CRUCIAL para better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++

# Directorio de trabajo
=======
# Multi-stage Dockerfile for Next.js production
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production

FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
>>>>>>> b3aa808e8f96135fbe0210ee95071806be59e6f7
WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Compilamos la aplicación
RUN npm run build

# Exponemos el puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]