FROM oven/bun:1 AS base
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/shared/dtos/package.json apps/shared/dtos/package.json
RUN bun install --frozen-lockfile

COPY apps/web apps/web
COPY apps/shared/dtos apps/shared/dtos

WORKDIR /repo/apps/web
RUN bun run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
