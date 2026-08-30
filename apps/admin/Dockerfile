# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/admin/Dockerfile -t slay-admin .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY apps/admin/package.json ./apps/admin/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps/admin ./apps/admin
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @slay/admin build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public
EXPOSE 3001
USER node
CMD ["node", "apps/admin/server.js"]
