FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci

COPY packages ./packages
COPY apps/web ./apps/web

RUN npm run -w packages/shared build && npm run -w apps/web build

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
