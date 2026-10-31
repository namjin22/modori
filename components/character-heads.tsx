// 몽이(강아지)·하루(여우)의 머리. 도리와 같은 넓은 모찌 틀(머리 타원 가운데 (60, 62), WIDE_FIT으로 한꺼번에 줄인다)에
// 모양만 바꿔 끼운다. 눈·코·입은 components/character-face.tsx가 같은 좌표계에서 그린다.
// 둥근 얼굴 하나에 점 눈이던 예전 두 캐릭터가 밋밋하고 서로 닮아 보인다는 피드백(2026-10-31)으로 다시 그렸다:
// 몽이는 노릇한 갈색 얼굴에 축 처진 큰 귀와 하얀 주둥이, 하루는 주황 얼굴에 크게 선 귀와 볼 털이다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.

import type { ReactNode } from "react";

// 색은 캐릭터마다 다르다. <svg>에 CSS 변수(--ch-*)로 넣고, 없으면 도리 색이다.
export const INK = "var(--ch-ink, #4a68b0)";
export const BODY = "var(--ch-body, #fffaf0)";
export const EAR = "var(--ch-ear, #ffd1dc)";
export const BLUSH = "var(--ch-blush, #ffb4c4)";

/** 실루엣 바깥으로 번지는 테두리 두께. 위아래 두 겹이 같은 값을 쓴다. */
export const OUTLINE = 8;

/** 도리·몽이·하루 그림 전체를 줄여 둘레 소품 자리를 남기는 변환. 머리 가운데 (60, 62)를 (60, 66)으로 옮긴다. */
export const WIDE_SCALE = 0.9;
export const WIDE_FIT = `translate(60 66) scale(${WIDE_SCALE}) translate(-60 -62)`;

const CREAM = "#fff6e8";

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

const Cheeks = () => (
  <>
    <ellipse cx={29} cy={69} rx={7} ry={4.6} fill={BLUSH} opacity={0.9} />
    <ellipse cx={91} cy={69} rx={7} ry={4.6} fill={BLUSH} opacity={0.9} />
  </>
);

const DOG_EARS = [
  "M27 33 Q10 36 7 60 Q5 82 20 86 Q34 88 38 66 Q40 44 27 33Z",
  "M93 33 Q110 36 113 60 Q115 82 100 86 Q86 88 82 66 Q80 44 93 33Z",
];

/** 몽이: 머리 옆으로 축 처진 큰 귀, 이마에서 주둥이로 이어지는 하얀 줄, 한쪽 눈 둘레 얼룩. */
export function MongHead() {
  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={OUTLINE / WIDE_SCALE} strokeLinejoin="round">
        {DOG_EARS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill={EAR}>
        {DOG_EARS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <Silhouette>
        <ellipse cx={60} cy={62} rx={41} ry={34.5} />
      </Silhouette>
      <ellipse cx={81} cy={58} rx={11} ry={12} fill={EAR} opacity={0.85} />
      <path d="M60 30 Q52 44 52 62 L68 62 Q68 44 60 30Z" fill={CREAM} />
      <ellipse cx={60} cy={75} rx={20} ry={14} fill={CREAM} />
      <Cheeks />
    </>
  );
}

const FOX_EARS = [
  "M15 54 Q8 24 22 3 Q44 12 56 34 Z",
  "M105 54 Q112 24 98 3 Q76 12 64 34 Z",
];

// 귀 끝의 짙은 부분. 귀 바깥·안쪽 곡선을 끝에서 40% 지점에서 나눈 같은 곡선이라 윤곽 밖으로 번지지 않는다.
const FOX_EAR_TIPS = [
  "M22 3 Q16.4 11.4 14.16 21.24 L38 12.28 Q30.8 6.6 22 3Z",
  "M98 3 Q103.6 11.4 105.84 21.24 L82 12.28 Q89.2 6.6 98 3Z",
];

const FOX_EAR_INNER = [
  "M22 47 Q18 28 26 14 Q41 21 50 34 Z",
  "M98 47 Q102 28 94 14 Q79 21 70 34 Z",
];

// 양옆 아래로 뾰족하게 뻗는 볼 털.
const FOX_TUFTS = ["M23 59 L8 75 L33 90 Z", "M97 59 L112 75 L87 90 Z"];

/** 귀를 안쪽으로 모아 둔다. 귀가 머리 틀 바깥으로 너무 벌어지면 하트·불꽃 같은 둘레 소품과 겹친다. */
const FOX_EAR_SHIFT = [3, -3];

function FoxParts({ paths }: { paths: string[] }) {
  return (
    <>
      {paths.map((d, i) => (
        <path key={d} d={d} transform={`translate(${FOX_EAR_SHIFT[i]} 0)`} />
      ))}
    </>
  );
}

// 하얀 아랫얼굴. 바깥 변은 머리 타원 아랫변을 그대로 따라가 윤곽 밖으로 번지지 않는다.
const FOX_LOWER_FACE = "M20 62 Q34 63 46 68 Q60 76 74 68 Q86 63 100 62 A40 33 0 0 1 20 62Z";

/** 하루: 크게 선 뾰족 귀(끝은 짙은 갈색, 안쪽은 크림색), 양옆 볼 털, 하얀 아랫얼굴. 무늬는 이 정도로만 둔다(많으면 어수선하다). */
export function HaruHead() {
  return (
    <>
      <Silhouette>
        <FoxParts paths={FOX_EARS} />
        {FOX_TUFTS.map((d) => (
          <path key={d} d={d} />
        ))}
        <ellipse cx={60} cy={62} rx={40} ry={33} />
      </Silhouette>
      <g fill="#fff1dc">
        <FoxParts paths={FOX_EAR_INNER} />
      </g>
      <g fill={EAR}>
        <FoxParts paths={FOX_EAR_TIPS} />
      </g>
      <g fill="#fffaf2">
        {FOX_TUFTS.map((d) => (
          <path key={d} d={d} />
        ))}
        <path d={FOX_LOWER_FACE} />
      </g>
      <Cheeks />
    </>
  );
}
