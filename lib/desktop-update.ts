/**
 * 데스크톱 앱 안 업데이트(2026-10-27 요청)의 웹 쪽 약속. 상태를 갖고 받고 설치하는 것은 앱(desktop/updater.js)이고,
 * 화면은 preload.js가 내주는 window.modoriUpdater로 읽고 누르기만 한다. 두 곳의 모양이 같아야 한다.
 */
export type UpdateStatus = "idle" | "checking" | "none" | "available" | "downloading" | "installing" | "error";

export type UpdateState = {
  /** 이 앱이 앱 안 업데이트를 할 수 있는지. 맥 앱(서명 없음)이나 개발 중에는 false. */
  supported: boolean;
  /** 지금 설치된 버전. */
  current: string;
  status: UpdateStatus;
  /** 새로 나온 버전. 아직 모르면 null. */
  version: string | null;
  /** 받는 중일 때 0~100. */
  percent: number;
  /** 사용자가 누른 동작이 실패했을 때의 한 줄 원문. */
  error: string | null;
};

export type ModoriUpdater = {
  getState: () => Promise<UpdateState | null>;
  check: () => void;
  start: () => void;
  /** 돌려주는 함수를 부르면 그만 듣는다. */
  onState: (callback: (state: UpdateState) => void) => () => void;
};

declare global {
  interface Window {
    // 데스크톱 앱 1.0.7부터 있다(desktop/preload.js). 웹 브라우저와 그보다 옛 앱에는 없다.
    modoriUpdater?: ModoriUpdater;
  }
}

/**
 * 새 버전을 알고 있고 아직 설치하지 않았는지(배너를 띄울 때). 확인만 실패한 것(버전을 모른다)은 마이페이지에서만 알린다.
 */
export function hasPendingUpdate(state: UpdateState | null): boolean {
  if (!state || !state.supported || !state.version) return false;
  return state.status === "available" || state.status === "downloading" || state.status === "installing" || state.status === "error";
}

/** 누르는 버튼의 글자. 새 버전을 알면 받는 버튼, 모르면 확인하는 버튼이다. */
export function updateButtonLabel(state: UpdateState): string {
  switch (state.status) {
    case "checking":
      return "확인하는 중";
    case "available":
      return "업데이트";
    case "downloading":
      return `받는 중 ${state.percent}%`;
    case "installing":
      return "설치하는 중";
    case "error":
      return state.version ? "다시 시도" : "다시 확인";
    default:
      return "업데이트 확인";
  }
}

/** 마이페이지 줄에 적는 지금 상태 한 줄. */
export function updateMessage(state: UpdateState): string {
  switch (state.status) {
    case "checking":
      return "새 버전을 확인하고 있어요";
    case "none":
      return "최신 버전이에요";
    case "available":
      return `새 버전 ${state.version}이 나왔어요`;
    case "downloading":
      return `${state.version} 받는 중이에요 (${state.percent}%)`;
    case "installing":
      return "설치하고 곧 다시 시작해요";
    case "error":
      return `업데이트하지 못했어요${state.error ? `: ${state.error}` : ""}`;
    default:
      return "";
  }
}
