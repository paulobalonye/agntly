FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/escrow-engine/ ./services/escrow-engine/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/escrow-engine
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/escrow-engine

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/escrow-engine/dist ./services/escrow-engine/dist
COPY --from=builder /app/services/escrow-engine/package.json ./services/escrow-engine/
ENV NODE_ENV=production
EXPOSE 3003
CMD ["node", "services/escrow-engine/dist/server.js"]
