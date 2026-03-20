FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json shared/
COPY services/*/package.json /tmp/services/
RUN for f in /tmp/services/*/package.json; do dir=$(basename $(dirname $f)); mkdir -p services/$dir && cp $f services/$dir/; done
RUN pnpm install --frozen-lockfile --prod=false

COPY shared/ shared/
RUN pnpm --filter @agntly/shared build

COPY services/api-gateway/ services/api-gateway/
RUN pnpm --filter @agntly/api-gateway build 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "--experimental-specifier-resolution=node", "services/api-gateway/dist/server.js"]
