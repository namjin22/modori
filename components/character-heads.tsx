// 도리(고양이)·몽이(강아지)·하루(너구리)의 머리. 2026-11-02 운영자가 보낸 참고 그림 세 장(굵은 짙은 갈색 선, 작은 점 눈,
// 크림색 아랫얼굴, 납작한 색칠)을 바탕으로 다시 그렸다. 셋 다 머리 가운데 (60, 62~66) 언저리에 두고 WIDE_FIT이 한꺼번에 줄여
// 둘레 소품 자리를 남긴다. 눈·코·입은 도리는 components/dori.tsx, 몽이·하루는 components/character-face.tsx가 같은 좌표계에서 그린다.
// 몸통은 그리지 않는다: 24px(반응 줄)까지 줄어들 때 얼굴이 읽히려면 얼굴만 크게 두는 편이 낫다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.

import type { ReactNode } from "react";

// 색은 캐릭터마다 다르다. <svg>에 CSS 변수(--ch-*)로 넣고, 없으면 도리(고양이) 색이다.
export const INK = "var(--ch-ink, #35201b)";
export const BODY = "var(--ch-body, #f0e5e4)";
export const EAR = "var(--ch-ear, #fcb4a8)";
/** 아랫얼굴·가슴 같은 크림색 털. 너구리만 조금 더 누렇다. */
export const CREAM = "var(--ch-cream, #fffaf0)";
/** 도리의 이마 줄무늬. */
const MARK = "var(--ch-mark, #bfb3b1)";
/** 하루(너구리)의 눈 둘레 검은 띠. 눈꺼풀 색과 같아서 components/character-face.tsx도 쓴다. */
export const MASK = "var(--ch-mask, #786c60)";

/** 실루엣 바깥으로 번지는 테두리 두께. 위아래 두 겹이 같은 값을 쓴다. */
export const OUTLINE = 8;

/** 도리·몽이·하루 그림 전체를 줄여 둘레 소품 자리를 남기는 변환. 머리 가운데 (60, 62)를 (60, 66)으로 옮긴다. */
export const WIDE_SCALE = 0.9;
export const WIDE_FIT = `translate(60 66) scale(${WIDE_SCALE}) translate(-60 -62)`;

type Ellipse = { cx: number; cy: number; rx: number; ry: number };

/**
 * 타원 머리의 아래쪽 조각(크림색 아랫얼굴). 위 경계의 양 끝이 타원 위에 있어서 머리 윤곽을 그대로 따라간다.
 * clipPath를 쓰지 않는 까닭: 같은 화면에 그림이 수십 개 나오는데 id가 겹치면 엉뚱한 것이 잘린다.
 * top은 오른쪽 끝에서 왼쪽 끝으로 돌아오는 경계 곡선 한 토막을 돌려준다.
 */
function lowerPart(e: Ellipse, y: number, top: (left: number, right: number) => string): string {
  const dx = e.rx * Math.sqrt(1 - ((y - e.cy) / e.ry) ** 2);
  const left = Number((e.cx - dx).toFixed(2));
  const right = Number((e.cx + dx).toFixed(2));
  const large = y < e.cy ? 1 : 0;

  return `M${left} ${y} A${e.rx} ${e.ry} 0 ${large} 0 ${right} ${y} ${top(left, right)}Z`;
}

/** 도형 묶음에 바깥 테두리만 두른다. 굵은 선으로 한 번, 몸 색으로 한 번 그려 겹치는 안쪽에는 선이 안 남는다. */
function Silhouette({ children }: { children: ReactNode }) {
  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={OUTLINE / WIDE_SCALE} strokeLinejoin="round">
        {children}
      </g>
      <g fill={BODY}>{children}</g>
    </>
  );
}

// ───────────────────────── 도리(고양이) ─────────────────────────

const CAT: Ellipse = { cx: 60, cy: 64, rx: 41, ry: 31 };

/** 뾰족하게 선 귀. 끝은 둥글고 머리 윗모서리에서 살짝 바깥으로 기운다. */
const CAT_EARS = [
  "M21 57 Q18 37 24 24 Q27 18 32 20 Q45 26 54 39 Z",
  "M99 57 Q102 37 96 24 Q93 18 88 20 Q75 26 66 39 Z",
];

const CAT_EAR_INNER = [
  "M27 48 Q26 37 29 30 Q38 33 46 41 Z",
  "M93 48 Q94 37 91 30 Q82 33 74 41 Z",
];

/** 눈 밑에서 코 둘레까지 올라오는 크림색. 양옆은 볼에서 시작해 눈 바로 밑을 지난다. */
const CAT_LOWER = lowerPart(CAT, 76, (left, right) => `C${right - 10} 76 78 69.5 60 69.5 C42 69.5 ${left + 10} 76 ${left} 76`);

/** 볼 바깥으로 삐져나오는 수염. 윤곽을 가로질러 얼굴 안에서 시작한다. */
const CAT_WHISKERS =
  "M29 70 Q20 67 11 68 M28 75.5 Q19 76.5 10 79.5 M30 80.5 Q22 84 15 88.5 M91 70 Q100 67 109 68 M92 75.5 Q101 76.5 110 79.5 M90 80.5 Q98 84 105 88.5";

/** 도리: 뾰족한 귀, 이마 줄무늬 셋, 크림색 아랫얼굴, 볼 수염. 몸은 연한 웜그레이(--ch-body). */
export function DoriHead() {
  return (
    <>
      <Silhouette>
        {CAT_EARS.map((d) => (
          <path key={d} d={d} />
        ))}
        <ellipse cx={CAT.cx} cy={CAT.cy} rx={CAT.rx} ry={CAT.ry} />
      </Silhouette>
      <g fill={EAR}>
        {CAT_EAR_INNER.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke={MARK} strokeWidth={3.6} strokeLinecap="round" fill="none">
        <path d="M49 38.5 Q50.4 42 50.6 46" />
        <path d="M60 37.5 L60 47" />
        <path d="M71 38.5 Q69.6 42 69.4 46" />
      </g>
      <path d={CAT_LOWER} fill={CREAM} />
      <path d={CAT_WHISKERS} stroke={INK} strokeWidth={2.1} strokeLinecap="round" fill="none" />
    </>
  );
}

// ───────────────────────── 몽이(강아지) ─────────────────────────

const DOG: Ellipse = { cx: 60, cy: 63, rx: 35, ry: 31 };

/**
 * 머리 위 모서리에서 볼 옆으로 처진 귀. 머리 뒤에 두어 얼굴을 덮지 않고 바깥쪽 반쯤만 보인다.
 * (머리 앞에 얹었더니 귀가 얼굴을 너무 덮고 자리가 애매해 보인다는 피드백, 2026-11-02)
 */
const DOG_EAR = "M0 -1 C-7 4 -12.5 16 -12 26 C-11.5 36 1.5 39 8 30.5 C13 23.5 9.5 8 3 -0.5 Q1 -2 0 -1Z";
const DOG_EAR_PLACE = ["translate(32 41) rotate(14)", "translate(88 41) rotate(-14)"];

/** 코 둘레의 동그란 주둥이가 눈높이까지 올라오고, 아래로 갈수록 볼 전체로 퍼지는 크림색. */
const DOG_LOWER = lowerPart(DOG, 83, (left, right) => `C${right - 9} 77 74 66.5 60 66.5 C46 66.5 ${left + 9} 77 ${left} 83`);

/** 몽이: 머리 뒤로 처진 갈색 귀, 노릇한 얼굴, 둥근 크림색 주둥이. 머리는 도리보다 작고 둥글다. */
export function MongHead() {
  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={OUTLINE / WIDE_SCALE} strokeLinejoin="round">
        {DOG_EAR_PLACE.map((transform) => (
          <path key={transform} d={DOG_EAR} transform={transform} />
        ))}
      </g>
      <g fill={EAR}>
        {DOG_EAR_PLACE.map((transform) => (
          <path key={transform} d={DOG_EAR} transform={transform} />
        ))}
      </g>
      <Silhouette>
        <ellipse cx={DOG.cx} cy={DOG.cy} rx={DOG.rx} ry={DOG.ry} />
      </Silhouette>
      <path d={DOG_LOWER} fill={CREAM} />
    </>
  );
}

// ───────────────────────── 하루(너구리) ─────────────────────────

const RACCOON: Ellipse = { cx: 60, cy: 66, rx: 43, ry: 26 };

const RACCOON_EARS = [
  "M21 59 Q18 38 25 24 Q28 18 33 21 Q47 28 54 43 Z",
  "M99 59 Q102 38 95 24 Q92 18 87 21 Q73 28 66 43 Z",
];

const RACCOON_EAR_INNER = [
  "M27 50 Q25 38 29 30 Q38 33 46 43 Z",
  "M93 50 Q95 38 91 30 Q82 33 74 43 Z",
];

/** 볼에서 바깥으로 뻗는 뾰족한 털 두 갈래. 너구리 윤곽의 가장 큰 단서다. */
const RACCOON_TUFTS = [
  "M23 67 L10 72 L20 76 L13 83 L27 83 Z",
  "M97 67 L110 72 L100 76 L107 83 L93 83 Z",
];

/**
 * 크림색 얼굴: 눈썹 자리의 비스듬한 지붕 두 개와 그 사이로 내려오는 회색 V자(콧등) 아래 전부.
 * 검은 띠가 이 위에 얹히므로 띠 둘레에 크림색 테두리가 저절로 남는다.
 */
const RACCOON_LOWER = lowerPart(
  RACCOON,
  65,
  (left) => `Q93 50 70 52 Q62 53 60 64 Q58 53 50 52 Q27 50 ${left} 65`,
);

/** 눈 둘레 검은 띠: 바깥쪽 끝이 처진 콩 모양 둘. */
const RACCOON_MASK = [
  { cx: 39.5, cy: 71, rotate: -13 },
  { cx: 80.5, cy: 71, rotate: 13 },
];

/** 정수리의 삐죽한 털 한 줌. */
const RACCOON_TOP_TUFT = "M54 40.6 q-1.4 -5 -4.6 -6.4 M59.5 39.6 q0.4 -6 -1.4 -8.6 M65 40.2 q1.8 -4.4 5 -5.4";

const RACCOON_EAR_TICKS = "M30.5 40 l5 2.6 M31.4 45 l4.4 2 M89.5 40 l-5 2.6 M88.6 45 l-4.4 2";

/** 하루: 뾰족한 귀, 볼의 털 뭉치, 크림색 얼굴 위에 얹힌 검은 눈 띠. 몸은 회갈색(--ch-body). */
export function HaruHead() {
  return (
    <>
      <Silhouette>
        {RACCOON_EARS.map((d) => (
          <path key={d} d={d} />
        ))}
        {RACCOON_TUFTS.map((d) => (
          <path key={d} d={d} />
        ))}
        <ellipse cx={RACCOON.cx} cy={RACCOON.cy} rx={RACCOON.rx} ry={RACCOON.ry} />
      </Silhouette>
      <g fill={EAR}>
        {RACCOON_EAR_INNER.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d={RACCOON_EAR_TICKS} stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <path d={RACCOON_TOP_TUFT} stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <g fill={CREAM}>
        <path d={RACCOON_LOWER} />
        {RACCOON_TUFTS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill={MASK}>
        {RACCOON_MASK.map((m) => (
          <ellipse key={m.cx} cx={m.cx} cy={m.cy} rx={16} ry={11.5} transform={`rotate(${m.rotate} ${m.cx} ${m.cy})`} />
        ))}
      </g>
    </>
  );
}
