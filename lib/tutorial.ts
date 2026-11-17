/**
 * 처음 쓰는 사람용 둘러보기(2026-11-16 요청). 실제 홈 화면 위에서 버튼과 칸을 하나씩 짚으며 무엇인지, 어떻게 쓰는지 알려 준다.
 * 단계 순서와 짚을 곳은 여기, 글은 lib/i18n/messages/tutorial.ts, 그리는 곳은 components/tour.tsx.
 * 브라우저 화면도 가져다 쓰므로 서버 전용 코드는 넣지 않는다.
 *
 * target은 화면 요소에 붙인 data-tour 값이다. null이면 짚을 곳 없이 가운데에 뜨는 첫 안내다.
 * 짚을 곳이 지금 화면에 없으면(할 일이 하나도 없어 "할 일 줄"이 없을 때 등) 그 단계는 건너뛴다.
 */
export const TOUR_STEPS = [
  { id: "intro", target: null },
  { id: "profile", target: "profile" },
  { id: "calendar", target: "calendar" },
  { id: "dayNav", target: "day-nav" },
  { id: "manage", target: "manage" },
  { id: "events", target: "events" },
  { id: "category", target: "category" },
  { id: "todo", target: "todo-row" },
  { id: "social", target: "tab-social" },
  { id: "myPage", target: "tab-myPage" },
] as const;

export type TourStep = (typeof TOUR_STEPS)[number];
export type TourStepId = TourStep["id"];

/** 시험이 자동 표시를 켜는 요청 머리글(아래 shouldAutoShowTutorial). */
export const TUTORIAL_TEST_HEADER = "x-modori-tutorial";

/**
 * 가입 뒤 처음 홈을 열 때 둘러보기를 띄울지. 이미 끝내거나 건너뛴 사람(그리고 이 기능이 생길 때 있던 사용자)은 띄우지 않는다.
 *
 * 시험 서버(AUTH_MODE=mock)는 가입 직후 곧바로 홈을 쓰길 기대하는 시험이 수십 개라(가려 놓은 화면은 누를 수 없다), 기본으로는 띄우지 않고
 * 둘러보기를 시험하는 시험만 머리글(x-modori-tutorial: on)로 켠다. 운영(mock이 아님)에서는 이 머리글을 보지 않는다.
 */
export function shouldAutoShowTutorial(input: { tutorialSeenAt: Date | null; mockAuth: boolean; testHeader: string | null }): boolean {
  if (input.tutorialSeenAt !== null) return false;
  if (input.mockAuth) return input.testHeader === "on";
  return true;
}

/** 홈이 둘러보기를 띄우는 까닭. first는 가입 뒤 처음, replay는 설정에서 다시 보기(?tour=1). */
export type TourMode = "first" | "replay";

export function tourMode(input: { auto: boolean; param: string | undefined }): TourMode | null {
  if (input.param === "1") return "replay";
  return input.auto ? "first" : null;
}

/** 화면에서 짚는 영역(뷰포트 기준 픽셀). 짚을 곳이 없는 안내는 화면 가운데의 크기 0 영역이다. */
export type Spot = { top: number; left: number; width: number; height: number; radius: number };

export type TipPlacement = {
  /**
   * above·below: 짚은 곳의 위·아래에 맞닿게. right·left: 가로 여유가 있을 때(넓은 화면) 짚은 곳의 옆에.
   * edge-top·edge-bottom: 어느 쪽에도 자리가 없어 화면 위·아래 끝에(짚은 곳을 가릴 수 있다). middle: 짚을 곳이 없어 가운데.
   */
  side: "above" | "below" | "right" | "left" | "edge-top" | "edge-bottom" | "middle";
  left: number;
  width: number;
  /** 화살표 중심의 자리. above·below는 말풍선 왼쪽 끝에서, right·left는 말풍선 위쪽 끝에서 잰다. 화살표가 없으면 null. */
  arrow: number | null;
  /** below·edge-top·right·left는 top, above·edge-bottom은 bottom(뷰포트 아래에서부터). */
  offset: number;
};

/** height는 말풍선 높이를 아직 재지 못했을 때 쓰는 값. 글이 길고 폭이 좁으면 더 커지므로 그릴 때마다 실제 높이를 넘긴다. */
export const TIP = { width: 340, margin: 12, gap: 14, height: 240, arrowInset: 22 } as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * 말풍선을 어디에 둘지. 짚은 곳 아래, 위, 오른쪽, 왼쪽 순으로 말풍선이 통째로 들어갈 자리가 있는지 보고 처음 되는 곳에 붙인다
 * (위쪽은 bottom 기준이라 짚은 곳에 맞닿는다). 어디도 안 되면 짚은 곳의 반대쪽 화면 끝에 둔다
 * (짚은 곳을 가릴 수 있지만 화면 밖으로 나가지는 않는다). 폭이 좁은 폰에서는 옆 자리가 없어 위·아래·끝만 쓰인다.
 */
export function placeTip(spot: Spot | null, viewport: { width: number; height: number }, height: number = TIP.height): TipPlacement {
  const width = Math.min(TIP.width, viewport.width - TIP.margin * 2);
  const centered = (viewport.width - width) / 2;
  if (!spot || (spot.width === 0 && spot.height === 0)) {
    return { side: "middle", left: centered, width, arrow: null, offset: 0 };
  }

  const spotCenterX = spot.left + spot.width / 2;
  const left = clamp(spotCenterX - width / 2, TIP.margin, viewport.width - width - TIP.margin);
  const arrowX = clamp(spotCenterX - left, TIP.arrowInset, width - TIP.arrowInset);

  const need = height + TIP.gap + TIP.margin;
  const below = viewport.height - (spot.top + spot.height);
  const above = spot.top;
  if (below >= need) return { side: "below", left, width, arrow: arrowX, offset: spot.top + spot.height + TIP.gap };
  if (above >= need) return { side: "above", left, width, arrow: arrowX, offset: viewport.height - spot.top + TIP.gap };

  // 옆 자리: 말풍선을 짚은 곳의 세로 가운데에 맞추되 화면 안에 가둔다.
  const spotCenterY = spot.top + spot.height / 2;
  const top = clamp(spotCenterY - height / 2, TIP.margin, viewport.height - height - TIP.margin);
  const arrowY = clamp(spotCenterY - top, TIP.arrowInset, Math.max(TIP.arrowInset, height - TIP.arrowInset));
  const sideRoom = width + TIP.gap + TIP.margin;
  if (viewport.width - (spot.left + spot.width) >= sideRoom) {
    return { side: "right", left: spot.left + spot.width + TIP.gap, width, arrow: arrowY, offset: top };
  }
  if (spot.left >= sideRoom) {
    return { side: "left", left: spot.left - TIP.gap - width, width, arrow: arrowY, offset: top };
  }

  // 자리가 모자라면 짚은 곳이 위쪽 절반이면 말풍선은 아래 끝에, 아래쪽 절반이면 위 끝에 둔다.
  const inUpperHalf = spotCenterY < viewport.height / 2;
  return inUpperHalf
    ? { side: "edge-bottom", left: centered, width, arrow: null, offset: TIP.margin }
    : { side: "edge-top", left: centered, width, arrow: null, offset: TIP.margin };
}
