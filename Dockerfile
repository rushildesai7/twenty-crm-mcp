FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsup.config.ts tsconfig.json ./
COPY src/ ./src/
COPY index.ts serve.ts ./
RUN npx tsup

FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/dist/serve.js ./serve.js

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)})" || exit 1

CMD ["node", "serve.js"]
