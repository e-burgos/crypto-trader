# Build stage
FROM node:22-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

# apps/web has no package.json — every dependency lives at the workspace root,
# same as apps/api. Copying apps/web/package.json failed the build outright, and
# no workflow builds this image, so nothing caught it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm nx build web --skip-nx-cache

# Production stage (nginx)
FROM nginx:alpine AS runner
COPY --from=builder /app/dist/apps/web /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
