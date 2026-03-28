FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci
RUN npx playwright install --with-deps chromium

COPY packages ./packages
COPY apps/api ./apps/api

RUN npm run -w apps/api prisma:generate && npm run -w packages/shared build && npm run -w apps/api build

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["npm", "run", "start"]
