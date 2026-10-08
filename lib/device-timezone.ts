/** 이 기기가 쓰는 시간대(IANA 이름). 서버에는 없고 브라우저에서만 읽는다. 못 읽으면 빈 값. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn("[timezone] 기기 시간대를 읽지 못했다.", error instanceof Error ? error.name : error);
    return "";
  }
}

/** useSyncExternalStore의 구독 자리. 기기 시간대는 화면이 떠 있는 동안 바뀌지 않는다고 본다. */
export const subscribeNothing = () => () => undefined;
