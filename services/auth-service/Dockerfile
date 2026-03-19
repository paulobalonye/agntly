FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY services/auth-service/ ./services/auth-service/
RUN npm install --workspace=@agntly/shared --workspace=@agntly/auth-service
RUN npm run build --workspace=@agntly/shared
RUN npm run build --workspace=@agntly/auth-service

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/services/auth-service/package.json ./services/auth-service/
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "services/auth-service/dist/server.js"]
