# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose your backend API/Socket.io port (assuming 5000)
EXPOSE 5000

# Start the server (change 'server.js' to your actual main file)
CMD ["node", "server.js"]