# Build stage
FROM node:20-slim AS build

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && node dist/src/main.js"]