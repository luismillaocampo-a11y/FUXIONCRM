# Usamos una imagen de Node.js oficial (basada en Debian, más completa)
FROM node:20

# Instalamos las herramientas necesarias para compilar librerías nativas
RUN apt-get update && apt-get install -y python3 make g++

# Directorio de trabajo
WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Compilamos la aplicación (Next.js)
RUN npm run build

# Exponemos el puerto 3000
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]