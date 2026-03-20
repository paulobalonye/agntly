FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Install all workspace deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY shared/package.json shared/
COPY services/*/package.json /tmp/services/
RUN for f in /tmp/services/*/package.json; do dir=$(basename $(dirname $f)); mkdir -p services/$dir && cp $f services/$dir/; done
RUN pnpm install --frozen-lockfile --prod=false

# Copy and build
COPY frontend/ frontend/
COPY shared/ shared/
COPY tsconfig.base.json ./

RUN cd frontend && pnpm build

ENV NODE_ENV=production
ENV PORT=3100
EXPOSE 3100

CMD ["node", "frontend/node_modules/.bin/next", "start", "-p", "3100"]
