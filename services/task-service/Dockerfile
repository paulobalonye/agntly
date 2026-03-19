FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/task-service/ ./services/task-service/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/task-service
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/task-service

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/task-service/dist ./services/task-service/dist
COPY --from=builder /app/services/task-service/package.json ./services/task-service/
ENV NODE_ENV=production
EXPOSE 3004
CMD ["node", "services/task-service/dist/server.js"]
