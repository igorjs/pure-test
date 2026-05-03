# Bun: install + build + test (fully independent)
ARG VARIANT=debian
FROM oven/bun:${VARIANT}

WORKDIR /app

COPY package.json ./
RUN bun install

ENV PATH="/app/node_modules/.bin:${PATH}"

COPY . .
RUN bun scripts/build.mjs

ENTRYPOINT ["bun", "tests/self-test.mjs"]
