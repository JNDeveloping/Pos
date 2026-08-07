FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run prisma:generate -w @rincon/api && npm run build -w @rincon/api
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
CMD ["node","dist/src/main.js"]
