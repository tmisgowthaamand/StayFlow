# Use Node.js LTS version
FROM node:18-slim

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose backend port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
