FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY docker/web/package.json docker/web/server.js ./
COPY docker/web/config ./config
COPY docker/web/lib ./lib
COPY docker/web/public ./public
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads

RUN npm install --omit=dev \
    && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
