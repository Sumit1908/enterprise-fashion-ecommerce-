# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t slay-api .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ---- build ----
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @slay/config build \
 && pnpm --filter @slay/db build \
 && pnpm --filter @slay/api build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
# Copy the built workspace as-is — matches exactly what runs in development.
COPY --from=build /app ./
WORKDIR /app/apps/api
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
