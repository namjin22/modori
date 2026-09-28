import { prisma } from "@/lib/prisma";

export type ErrorSource = "server" | "client";

const MAX_MESSAGE = 300;
const KEEP_DAYS = 30;

/**
 * 사용자가 화면을 다 받기 전에 다른 화면으로 넘어가거나 창을 닫아 연결이 끊긴 경우.
 * 고칠 것이 없는 일인데 Next는 서버 오류로 넘겨준다. 그대로 두면 사람이 많을 때 매시간 알림이
 * 헛울린다(테스트 DB에서 하루 27건). 메시지가 정확히 같은 것만 거른다.
 */
const CLIENT_ABORT_MESSAGES = new Set(["The destination stream closed early."]);

export function isClientAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "ResponseAborted" || CLIENT_ABORT_MESSAGES.has(error.message);
}

/**
 * 오류 내용은 첫 줄만 남긴다. Prisma 검사 오류는 둘째 줄부터 넘긴 값(할 일 내용 같은 사용자 입력)을
 * 그대로 적는다. 첫 줄은 "Invalid `prisma.todo.create()` invocation:"처럼 무엇이 실패했는지만 말한다.
 */
export function safeMessage(message: string): string {
  return message.split(/\r?\n/)[0].trim().slice(0, MAX_MESSAGE);
}

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
        message: safeMessage(input.message) || "(내용 없음)",
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
