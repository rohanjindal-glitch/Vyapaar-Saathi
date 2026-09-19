FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY vite.config.js ./
COPY web ./web
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/saathi.db
VOLUME /data
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]

