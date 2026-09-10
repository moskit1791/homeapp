FROM node:24-bookworm-slim AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages packages
RUN pnpm install --filter @homeapp/web... --frozen-lockfile
COPY apps/web apps/web
COPY tsconfig.base.json ./
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=/api
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm --filter @homeapp/shared-types build && pnpm --filter @homeapp/web build

FROM nginx:stable-alpine
COPY deploy/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
