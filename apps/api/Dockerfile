# Pinned to the exact Bun version bun.lock was generated with. A floating
# oven/bun:1 tag resolves to whatever the latest 1.x patch is at build time,
# and a newer Bun can reject the same lockfile under --frozen-lockfile
# (verified: 1.3.14 rejected a lockfile 1.3.10 accepts unmodified) — bump
# this deliberately alongside `bun --version` locally, not by surprise.
FROM oven/bun:1.3.10 AS base
WORKDIR /repo

# --frozen-lockfile needs every workspace member's manifest present, even
# ones this image doesn't run (root package.json declares apps/web too) —
# without apps/web/package.json here, bun sees a workspace member missing
# from disk and rejects the lockfile as "changed", even though it isn't.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/shared/dtos/package.json apps/shared/dtos/package.json
RUN bun install --frozen-lockfile

COPY apps/api apps/api
COPY apps/shared/dtos apps/shared/dtos

WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["bun", "run", "start"]
