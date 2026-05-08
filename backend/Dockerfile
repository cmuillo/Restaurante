# ---- Dev stage ----
FROM node:20-alpine AS dev
WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install --ignore-scripts

COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install --ignore-scripts

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm config set strict-ssl false && npm install --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "node dist/database/seeds/run-seeds.js && node dist/main"]
