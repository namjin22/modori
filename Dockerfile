# GSMSV VM에서 돌리는 이미지. VM은 메모리가 4GB라 빌드는 VM 밖에서 하고,
# VM은 이 이미지를 받아 실행만 한다(deploy/README.md).
FROM node:24-bookworm-slim AS base
# Prisma 엔진이 OpenSSL을 찾는다. slim 이미지에는 없다.
RUN apt-get update -qq && apt-get install -y -qq openssl ca-certificates >/dev/null && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# 배포할 때 `prisma migrate deploy`를 이 이미지로 돌린다. CLI만 따로 설치한다.
# node_modules에서 prisma 폴더만 복사하면 딸린 패키지(@prisma/debug 등)가 빠져 돌지 않는다.
FROM base AS migrator
WORKDIR /migrate
COPY package.json /tmp/package.json
RUN npm install --no-audit --no-fund --no-save "prisma@$(node -p "require('/tmp/package.json').devDependencies.prisma")"

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=migrator /migrate/node_modules /migrate/node_modules
USER node
EXPOSE 3000
CMD ["node", "server.js"]
