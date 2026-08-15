FROM node:24-bookworm-slim AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN npm install --global pnpm@11.21.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS production-dependencies

# Docker build steps are non-interactive, but they do not inherit GitHub's CI
# environment. Ignore lifecycle scripts because `prepare` depends on the dev-only
# SvelteKit binary that this step intentionally removes.
RUN CI=true pnpm prune --prod --ignore-scripts

FROM dependencies AS build

COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN mkdir -p /data \
	&& chown node:node /data

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./package.json

COPY --from=build --chown=node:node /app/build ./build
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node scripts/migrate.mjs ./scripts/migrate.mjs

USER node

EXPOSE 3000
STOPSIGNAL SIGTERM

CMD ["node", "build"]
