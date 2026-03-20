FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY services/auth-service/package.json services/auth-service/
COPY services/wallet-service/package.json services/wallet-service/
COPY services/escrow-engine/package.json services/escrow-engine/
COPY services/task-service/package.json services/task-service/
COPY services/registry-service/package.json services/registry-service/
COPY services/payment-service/package.json services/payment-service/
COPY services/webhook-service/package.json services/webhook-service/
COPY services/settlement-worker/package.json services/settlement-worker/
COPY services/api-gateway/package.json services/api-gateway/
RUN pnpm install --frozen-lockfile --prod=false

COPY shared/ shared/
COPY frontend/ frontend/

RUN cd frontend && pnpm build

ENV NODE_ENV=production
ENV PORT=3100
EXPOSE 3100

CMD ["node", "frontend/node_modules/.bin/next", "start", "-p", "3100"]
