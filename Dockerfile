# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace manifests and lock file first (layer-cache deps install)
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

COPY packages/shared/package.json    packages/shared/
COPY packages/parser/package.json    packages/parser/
COPY packages/core/package.json      packages/core/
COPY packages/types/package.json     packages/types/
COPY packages/ui/package.json        packages/ui/
COPY packages/api-client/package.json packages/api-client/
COPY packages/web/package.json       packages/web/

RUN npm ci

# Copy all source after deps are installed
COPY packages/ packages/

# 1. Compile the engine packages (shared built transitively via project references)
RUN npm run build

# 2. Build the Next.js app (runs inside packages/web against the linux/amd64 native binaries)
WORKDIR /app/packages/web
RUN npx next build

# ---- Runtime stage ----
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV REPOHIVE_INDEX_ROOT=/data/indexes

# Next.js standalone bundle. Note the shape: because this is an npm workspace,
# the bundle is nested — `server.js` lands at `packages/web/server.js`, NOT at
# the root — which is why WORKDIR stays /app and CMD names the nested path.
COPY --from=builder /app/packages/web/.next/standalone ./

# Static assets — must sit where the standalone server expects them
COPY --from=builder /app/packages/web/.next/static    ./packages/web/.next/static
COPY --from=builder /app/packages/web/public           ./packages/web/public

# Engine dist: the forked child process loads these directly
COPY --from=builder /app/packages/parser/dist     ./packages/parser/dist
COPY --from=builder /app/packages/core/dist       ./packages/core/dist
COPY --from=builder /app/packages/shared/dist     ./packages/shared/dist

# package.json files so Node's workspace resolution finds the package names
COPY --from=builder /app/packages/parser/package.json  ./packages/parser/
COPY --from=builder /app/packages/core/package.json    ./packages/core/
COPY --from=builder /app/packages/shared/package.json  ./packages/shared/

# Full root node_modules: the forked child needs tree-sitter-java, web-tree-sitter,
# graphology, etc. via require.resolve. The standalone's bundled node_modules is a
# subset; overlaying the full hoisted workspace modules is a superset of both needs.
COPY --from=builder /app/node_modules ./node_modules

# The ingest child, copied explicitly rather than left to Next's tracing.
# Measured 2026-09-10: tracing pulls in `runner.mjs` but NOT the `tar.mjs` it
# statically imports, so the child would die with ERR_MODULE_NOT_FOUND on the
# first ingest. Copying the directory covers both files and anything added later.
COPY --from=builder /app/packages/web/src/lib/indexing ./packages/web/src/lib/indexing

# `runner.mjs` is spawned by path, not imported, so point the resolver straight
# at it instead of relying on its cwd-relative candidate list.
ENV REPOHIVE_RUNNER_PATH=/app/packages/web/src/lib/indexing/runner.mjs

RUN mkdir -p /data/indexes

EXPOSE 3000

# /api/repos is the only confirmed handler — /health and /metrics have no route
# implementations (middleware.ts matcher only) and would permanently 404.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/repos',function(r){process.exit(r.statusCode===200?0:1)}).on('error',function(){process.exit(1)})"

# Nested because this is an npm workspace: the standalone bundle puts server.js
# at packages/web/server.js, not at the bundle root. Verified 2026-09-10 against
# a real `next build` — `node server.js` from /app exits immediately.
CMD ["node", "packages/web/server.js"]
