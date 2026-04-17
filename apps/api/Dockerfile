FROM node:20-bookworm-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci
RUN mkdir -p /ms-playwright
RUN PLAYWRIGHT_BROWSERS_PATH=/ms-playwright node ./node_modules/playwright/cli.js install --with-deps chromium && ls -la /ms-playwright

COPY packages ./packages
COPY apps/api ./apps/api

RUN npm run -w apps/api prisma:generate && npm run -w packages/shared build && npm run -w apps/api build

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["npm", "run", "start"]
