FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/wallet-service/ ./services/wallet-service/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/wallet-service
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/wallet-service

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/wallet-service/dist ./services/wallet-service/dist
COPY --from=builder /app/services/wallet-service/package.json ./services/wallet-service/
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "services/wallet-service/dist/server.js"]
