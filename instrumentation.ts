import type { Instrumentation } from "next";

/** 서버가 켜질 때 한 번. 내가 정한 알림과 오늘 일정 알림을 1분마다 확인하는 반복을 건다(lib/push-loop.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPushLoop } = await import("@/lib/push-loop");
  startPushLoop();
}

/**
 * 서버에서 난 오류를 DB에 남긴다(lib/errors.ts). /admin/errors에서 보고, GitHub Actions가
 * 매시간 수를 세어 있으면 알린다. 외부 서비스 없이 Next가 제공하는 훅만 쓴다.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  // DB는 Node.js에서만 쓴다.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isClientAbort, recordError } = await import("@/lib/errors");
  if (isClientAbort(error)) return;
  await recordError({
    source: "server",
    message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    digest:
      typeof error === "object" && error !== null && "digest" in error
        ? String(error.digest)
        : null,
    path: request.path,
  });
};
