FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config and lockfile first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
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
COPY services/echo-agent/package.json services/echo-agent/
COPY services/license-service/package.json services/license-service/

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build shared package
RUN pnpm --filter @agntly/shared build

# Build frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd frontend && npx next build

EXPOSE 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3100 4000
