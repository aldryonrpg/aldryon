# Pinned to the exact Bun version bun.lock was generated with — see
# apps/api/Dockerfile for why a floating oven/bun:1 tag is unsafe here.
FROM oven/bun:1.3.10 AS base
WORKDIR /repo

# --frozen-lockfile needs every workspace member's manifest present, even
# ones this image doesn't run (root package.json declares apps/api too) —
# see apps/api/Dockerfile for the same fix in reverse.
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/shared/dtos/package.json apps/shared/dtos/package.json
RUN bun install --frozen-lockfile

COPY apps/web apps/web
COPY apps/shared/dtos apps/shared/dtos

WORKDIR /repo/apps/web

# Next.js inlines NEXT_PUBLIC_* into the client bundle at BUILD time, not at
# container start — so these must arrive as build args, not runtime env vars.
# Render's Docker-runtime services auto-forward matching dashboard env vars
# as --build-arg for every ARG declared here (the aldryon-web env vars in
# render.yaml were already listed; without these ARG lines the build never
# actually saw them). Locally, docker-compose.yml supplies the same values
# read from apps/web/.env.local.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN bun run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
