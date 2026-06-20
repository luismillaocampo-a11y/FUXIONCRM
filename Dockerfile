# Usamos una imagen de Node.js oficial (basada en Debian)
FROM node:20

# 1. Instalamos las herramientas necesarias para compilar librerías nativas
# Esto es CRUCIAL para better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++

# Directorio de trabajo
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