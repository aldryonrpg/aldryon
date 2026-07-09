FROM oven/bun:1 AS base
WORKDIR /repo

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/shared/dtos/package.json apps/shared/dtos/package.json
RUN bun install --frozen-lockfile

COPY apps/api apps/api
COPY apps/shared/dtos apps/shared/dtos

WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["bun", "run", "start"]
