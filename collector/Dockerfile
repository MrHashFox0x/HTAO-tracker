# Build context = repo root:  docker build -f collector/Dockerfile -t htao-collector .
FROM node:20-alpine

WORKDIR /app

# Install only the collector's deps.
COPY collector/package.json ./package.json
RUN npm install --omit=dev

# Collector source (schema is inlined in index.mjs, so db/ is optional).
COPY collector/index.mjs ./index.mjs

ENV NODE_ENV=production
CMD ["node", "index.mjs"]
