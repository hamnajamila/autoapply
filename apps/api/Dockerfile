FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY ../../package.json ../../tsconfig.base.json /tmp/root/
COPY ../../packages/shared /tmp/shared

RUN npm install -w @autoapply/shared --prefix /tmp/root && \
    npm install

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["npm","run","start"]

