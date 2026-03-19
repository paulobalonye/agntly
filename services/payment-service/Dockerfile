FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/payment-service/ ./services/payment-service/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/payment-service
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/payment-service

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/payment-service/dist ./services/payment-service/dist
COPY --from=builder /app/services/payment-service/package.json ./services/payment-service/
ENV NODE_ENV=production
EXPOSE 3006
CMD ["node", "services/payment-service/dist/server.js"]
