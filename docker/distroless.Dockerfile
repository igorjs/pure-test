# Distroless: verify library works in minimal production environment.
# No shell, no package manager, no build tools. Just Node + the built library.
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim AS build

WORKDIR /app

RUN (command -v corepack >/dev/null 2>&1 || npm install -g --force corepack) && corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/tests/self-test.mjs ./tests/

ENTRYPOINT ["/nodejs/bin/node", "tests/self-test.mjs"]
