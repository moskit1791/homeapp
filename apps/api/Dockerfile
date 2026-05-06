FROM node:20-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-validation/package.json packages/shared-validation/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN pnpm install --frozen-lockfile

COPY db db
COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @homeapp/shared-types build \
  && pnpm --filter @homeapp/shared-validation build \
  && pnpm --filter @homeapp/api build

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @homeapp/api db:migrate && node apps/api/dist/main.js"]
