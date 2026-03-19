FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/registry-service/ ./services/registry-service/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/registry-service
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/registry-service

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/registry-service/dist ./services/registry-service/dist
COPY --from=builder /app/services/registry-service/package.json ./services/registry-service/
ENV NODE_ENV=production
EXPOSE 3005
CMD ["node", "services/registry-service/dist/server.js"]
