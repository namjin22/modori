import { prisma } from "@/lib/prisma";

export type ErrorSource = "server" | "client";

const MAX_MESSAGE = 300;
const KEEP_DAYS = 30;

/** 주소의 경로만 남긴다. 쿼리에는 무엇이 들어올지 몰라 버린다. */
function pathOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.split("?")[0].slice(0, 200);
  return path.startsWith("/") ? path : null;
}

/**
 * 오류를 DB에 남긴다. 오류를 기록하다 또 오류가 나도 요청을 망치지 않게 여기서 끝낸다.
 * 가끔 30일 지난 기록을 지워 표가 계속 자라지 않게 한다.
 */
export async function recordError(input: {
  source: ErrorSource;
  message: string;
  digest?: string | null;
  path?: string | null;
}) {
  try {
    await prisma.errorEvent.create({
      data: {
        source: input.source,
        message: input.message.slice(0, MAX_MESSAGE) || "(내용 없음)",
        digest: input.digest?.slice(0, 64) ?? null,
        path: pathOnly(input.path),
      },
    });
    if (Math.random() < 0.02) {
      await prisma.errorEvent.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } },
      });
    }
  } catch (error) {
    console.error("[errors] 오류를 기록하지 못했다.", error);
  }
}
