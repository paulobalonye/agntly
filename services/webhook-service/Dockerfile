FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/webhook-service/ ./services/webhook-service/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/webhook-service
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/webhook-service

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/webhook-service/dist ./services/webhook-service/dist
COPY --from=builder /app/services/webhook-service/package.json ./services/webhook-service/
ENV NODE_ENV=production
EXPOSE 3007
CMD ["node", "services/webhook-service/dist/server.js"]
