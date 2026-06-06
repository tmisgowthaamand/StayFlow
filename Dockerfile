FROM node:18-slim

# Set production environment
ENV NODE_ENV=production

# Install only essential system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Build dashboard (needs devDependencies like vite — override NODE_ENV for this step only)
RUN cd dashboard && NODE_ENV=development npm install && npm run build

# Don't run as root
RUN groupadd -r stayflow && useradd -r -g stayflow stayflow
RUN chown -R stayflow:stayflow /app
USER stayflow

EXPOSE 3000

CMD ["node", "src/index.js"]
