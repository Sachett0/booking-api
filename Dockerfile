# syntax=docker/dockerfile:1

# Node 24 runs TypeScript directly (type stripping), so there is no build
# step: the image only needs production dependencies and the source code.
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Copy the manifests first: as long as they do not change, Docker reuses the
# cached `npm ci` layer and rebuilds only the layers below.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY migrations ./migrations

# Do not run as root inside the container.
USER node

EXPOSE 3333

# Node is PID 1 and receives SIGTERM from `docker stop` directly, which
# triggers the graceful shutdown in server.ts.
CMD ["node", "src/server.ts"]
