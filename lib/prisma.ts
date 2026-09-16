import { PrismaClient } from "@prisma/client";

// 개발 중에는 핫리로드마다 모듈이 새로 평가되므로, 매번 new PrismaClient()를 하면
// 커넥션이 쌓인다. Neon 무료 플랜은 동시 연결 수 제한이 있어서 금방 막힌다.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

// 프로덕션은 프로세스가 한 번만 뜨므로 캐시할 이유가 없다.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
