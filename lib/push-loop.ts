import { sendDueAlarms } from "@/lib/alarm-send";
import { sendDueEventDigests } from "@/lib/event-digest-send";

const LOOP_MS = 60 * 1000;

// 개발 서버는 파일을 고칠 때마다 모듈을 다시 읽는다. 반복을 전역에 하나만 걸어 겹치지 않게 한다.
const loop = globalThis as typeof globalThis & { modoriPushLoop?: ReturnType<typeof setInterval> };

/**
 * 서버가 켜질 때 한 번 부른다(instrumentation.ts). 때가 된 푸시를 1분마다 찾아 보낸다: 내가 정한 알림, 오늘 일정 알림.
 * 외부 예약 서비스나 VM 예약 작업 없이 앱 서버 하나로 돈다. 하나가 실패해도 다른 하나는 간다.
 */
export function startPushLoop() {
  if (loop.modoriPushLoop) return;
  loop.modoriPushLoop = setInterval(() => {
    sendDueAlarms().catch((error) => console.error("[alarm] 내가 정한 알림을 보내지 못했다.", error));
    sendDueEventDigests().catch((error) => console.error("[event-digest] 오늘 일정 알림을 보내지 못했다.", error));
  }, LOOP_MS);
}
