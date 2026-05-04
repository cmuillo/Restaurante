# ---- Dev stage ----
FROM node:20-alpine AS dev
WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install --ignore-scripts

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:admin", "--", "--host", "0.0.0.0"]

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install --ignore-scripts

COPY . .
RUN npm run build:all

# ---- Serve with nginx ----
FROM nginx:1.27-alpine AS production

# Copiar builds de cada app a rutas distintas
COPY --from=builder /app/dist/admin  /usr/share/nginx/html/admin
COPY --from=builder /app/dist/pos    /usr/share/nginx/html/pos
COPY --from=builder /app/dist/kitchen /usr/share/nginx/html/kitchen
COPY --from=builder /app/dist/kiosk  /usr/share/nginx/html/kiosk
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
