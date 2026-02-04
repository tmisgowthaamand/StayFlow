# Build stage
FROM node:18-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Standard Nginx config for SPA
RUN printf "server { \n \
    listen 80; \n \
    location / { \n \
        root /usr/share/nginx/html; \n \
        index index.html index.htm; \n \
        try_files \$uri \$uri/ /index.html; \n \
    } \n \
}" > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
