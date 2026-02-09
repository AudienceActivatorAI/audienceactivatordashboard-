FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @dealerbdc/database build
RUN pnpm --filter @dealerbdc/api build
RUN pnpm --filter @dealerbdc/dashboard build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist

CMD ["/bin/sh", "-c", "if [ \"$SERVICE\" = \"dashboard\" ]; then printf '{\"apiBase\":\"%s\"}' \"$VITE_API_BASE\" > /app/apps/dashboard/dist/runtime-config.json; pnpm --filter @dealerbdc/dashboard preview --host 0.0.0.0 --port $PORT; else pnpm --filter @dealerbdc/api start; fi"]
