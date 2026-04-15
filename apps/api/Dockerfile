# Base stage
FROM node:22-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# Dependencies stage — apps/api has no package.json, all deps live at root
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Builder stage
FROM deps AS builder
COPY . .
# Generate Prisma client before building (DATABASE_URL needed by prisma.config.ts loader)
RUN cd apps/api && DATABASE_URL=postgresql://dummy:dummy@localhost/dummy \
    ../../node_modules/.bin/prisma generate
# Build API — output goes to dist/apps/api/ (see webpack.config.js)
RUN pnpm nx build api --skip-nx-cache

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the full node_modules from builder (already has all prod + prisma deps)
COPY --from=builder /app/node_modules ./node_modules
# Copy compiled bundle
COPY --from=builder /app/dist/apps/api ./dist/apps/api
# Copy Prisma schema & migrations
COPY --from=builder /app/apps/api/prisma apps/api/prisma
# Copy generated Prisma client
COPY --from=builder /app/apps/api/generated ./apps/api/generated

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma 2>/dev/null || true && node dist/apps/api/main.js"]
