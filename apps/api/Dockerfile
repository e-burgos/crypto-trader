# Base stage
FROM node:22-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @crypto-trader/api...

# Builder stage
FROM deps AS builder
COPY . .
RUN pnpm nx build api --skip-nx-cache

# Production stage
FROM node:22-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

RUN pnpm install --frozen-lockfile --prod --filter @crypto-trader/api... && \
    pnpm --filter @crypto-trader/api exec prisma generate 2>/dev/null || true

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
