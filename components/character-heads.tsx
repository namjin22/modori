// 몽이(강아지)·하루(여우)의 머리. 도리와 같은 머리 가운데 (60, 62)에 모양만 바꿔 끼운다(몽이는 WIDE_FIT, 하루는 FOX_FIT으로 줄인다).
// 눈·코·입은 components/character-face.tsx가 같은 좌표계에서 그린다.
// 2026-11-01 피드백("강아지는 얼굴이 너무 크고, 여우는 볼 쪽이 어색하다")으로 다시 그렸다:
// 몽이는 머리를 갸름하게 줄이고 귀를 머리에 붙여 작게, 하루는 볼 털을 없애고 아래로 좁아지는 얼굴에 볼에서 코로 모이는 하얀 아랫얼굴이다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.

import type { ReactNode } from "react";

// 색은 캐릭터마다 다르다. <svg>에 CSS 변수(--ch-*)로 넣고, 없으면 도리 색이다.
export const INK = "var(--ch-ink, #4a68b0)";
export const BODY = "var(--ch-body, #a9c4f5)";
export const EAR = "var(--ch-ear, #ffc4d2)";
export const BLUSH = "var(--ch-blush, #ff9fb4)";

/** 실루엣 바깥으로 번지는 테두리 두께. 위아래 두 겹이 같은 값을 쓴다. */
export const OUTLINE = 8;

/** 도리·몽이·하루 그림 전체를 줄여 둘레 소품 자리를 남기는 변환. 머리 가운데 (60, 62)를 (60, 66)으로 옮긴다. */
export const WIDE_SCALE = 0.9;
export const WIDE_FIT = `translate(60 66) scale(${WIDE_SCALE}) translate(-60 -62)`;

/** 하루는 귀가 높고 턱이 뾰족해 도리와 같은 비율로 줄이면 혼자 커 보인다. 조금 더 줄인다. */
export const FOX_SCALE = 0.84;
export const FOX_FIT = `translate(60 66) scale(${FOX_SCALE}) translate(-60 -62)`;

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

const DOG_EARS = [
  "M34 38 Q19 40 17 60 Q16 78 27 81 Q36 81 38 66 Q39 50 34 38Z",
  "M86 38 Q101 40 103 60 Q104 78 93 81 Q84 81 82 66 Q81 50 86 38Z",
];

/** 몽이: 머리 옆으로 처진 귀, 이마에서 주둥이로 이어지는 하얀 줄, 한쪽 눈 둘레 얼룩, 튀어나온 크림색 주둥이. 머리는 도리보다 작고 갸름하다. */
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
        <ellipse cx={60} cy={62} rx={35} ry={31} />
      </Silhouette>
      <ellipse cx={76} cy={57} rx={10} ry={11} fill={EAR} opacity={0.85} />
      <path d="M60 32 Q55 43 55 58 L55.5 70 L64.5 70 L65 58 Q65 43 60 32Z" fill={CREAM} />
      <ellipse cx={60} cy={77} rx={17} ry={12} fill={CREAM} />
      <ellipse cx={32} cy={71} rx={6} ry={4.2} fill={BLUSH} opacity={0.9} />
      <ellipse cx={88} cy={71} rx={6} ry={4.2} fill={BLUSH} opacity={0.9} />
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

// 얼굴 윤곽: 볼이 가장 넓고 턱이 뾰족하게 모인다(여우는 둥근 원이 아니라 아래로 좁아지는 얼굴이다).
const FOX_HEAD = "M19 58 C19 42 36 30 60 30 C84 30 101 42 101 58 C101 76 82 92 60 95 C38 92 19 76 19 58Z";

// 주황 위쪽 얼굴: 윤곽 위쪽을 그대로 따라가고, 아래는 볼에서 코 쪽으로 모이는 곡선으로 닫는다. 곡선 아래가 하얀 아랫얼굴이다.
const FOX_UPPER_FACE = "M19 58 C19 42 36 30 60 30 C84 30 101 42 101 58 Q88 60 76 68 Q66 74 60 74 Q54 74 44 68 Q32 60 19 58Z";

/** 하루: 크게 선 뾰족 귀(끝은 짙은 갈색, 안쪽은 크림색), 주황 얼굴, 볼에서 코로 모이는 하얀 아랫얼굴. 볼 털은 두지 않는다(어색하다는 피드백). */
export function HaruHead() {
  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={OUTLINE / FOX_SCALE} strokeLinejoin="round">
        <FoxParts paths={FOX_EARS} />
        <path d={FOX_HEAD} />
      </g>
      <path d={FOX_HEAD} fill="#fffaf2" />
      <g fill={BODY}>
        <FoxParts paths={FOX_EARS} />
        <path d={FOX_UPPER_FACE} />
      </g>
      <g fill="#fff1dc">
        <FoxParts paths={FOX_EAR_INNER} />
      </g>
      <g fill={EAR}>
        <FoxParts paths={FOX_EAR_TIPS} />
      </g>
      <ellipse cx={30} cy={69} rx={7} ry={4.6} fill={BLUSH} opacity={0.9} />
      <ellipse cx={90} cy={69} rx={7} ry={4.6} fill={BLUSH} opacity={0.9} />
    </>
  );
}
