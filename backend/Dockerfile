# backend/Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy app source
COPY backend/ ./

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "app.js"]
