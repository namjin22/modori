/**
 * 오류 화면에서 저절로 새로고침할지. 같은 오류로 새로고침이 끝없이 되풀이되지 않게, 마지막 자동 새로고침에서 15초가
 * 지나지 않았으면 하지 않는다(그때는 오류 화면의 버튼으로 사람이 고른다). 브라우저 안에서만 부른다.
 */
const KEY = "modori-auto-reload-at";
const WINDOW_MS = 15_000;

export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch (error) {
    // 저장소가 막힌 창에서는 되풀이를 막을 수 없어 저절로 새로고침하지 않는다.
    console.warn("[reload] 새로고침 기록을 쓰지 못했다.", error instanceof Error ? error.name : error);
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * 화면을 옮기는 요청이 끊겨 난 오류인지. Safari(아이폰 앱 포함)는 끊긴 요청을 "Load failed", 크롬은 "Failed to fetch"로 알리고,
 * 새 배포 뒤 옛 화면이 사라진 조각 파일을 부르면 ChunkLoadError가 난다. 이런 오류는 다시 불러오면 낫는다.
 */
export function isLoadFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ChunkLoadError" ||
    /Load failed|Failed to fetch|NetworkError|Loading chunk|Importing a module script failed/i.test(error.message)
  );
}
