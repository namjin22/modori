// 모도리의 캐릭터 "도리". 옆으로 넓은 모찌 고양이 얼굴이다. 크림색 얼굴에 큰 둥근 귀와
// 머리 윗부분을 파랗게 덮고 이마가 흰 쐐기로 갈라지는 하치와레 무늬를 두고, 눈은 크고
// 낮게 놓아 아기처럼 순해 보이게 했다. 하치와레는 털 무늬 이름이라 무늬만 쓴다.
// 몸통을 붙이면 작게 줄였을 때 비율이 어색해져서 얼굴만 그린다. 표정은 눈·입과
// 둘레의 소품으로만 전한다.
// 직접 그린 그림이라 외부 저작권이나 표기 의무가 없다.
//
// 테두리는 도형마다 그리지 않는다. 같은 실루엣을 두 번 그려서 아래 겹은 굵은 선으로
// 부풀리고 위 겹을 몸 색으로 덮는다. 이렇게 해야 도형이 겹치는 안쪽에는 선이 남지
// 않고 바깥 윤곽만 고르게 두꺼워진다.
//
// 얼굴은 크림색이지만 파란 무늬와 진한 파랑 테두리가 있어 흰 바탕에서도 윤곽이 서고(예전
// 도리는 무늬가 없어 얼굴이 묻혔다) 다크 모드에서도 배경에서 떠오른다. 24px(반응 줄)까지
// 줄어들기 때문에 눈·입은 크고 단순하게 그린다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.

import type { CSSProperties, ReactNode } from "react";

import { CharacterFace, CharacterProps } from "@/components/character-face";
import { DEFAULT_CHARACTER, type CharacterId, type CharacterMood } from "@/lib/characters";

export type DoriMood =
  | "happy"
  | "like"
  | "fire"
  | "clap"
  | "party"
  | "calm"
  | "sad"
  | "confused"
  | "hello"
  | "cool"
  | "wow"
  | "love";

// 색은 캐릭터마다 다르다. <svg>에 CSS 변수(--ch-*)로 넣고, 없으면 도리 색이다.
const INK = "var(--ch-ink, #4a68b0)";
const BODY = "var(--ch-body, #fffaf0)";
const EYE = "#5d6f96";
const EAR = "var(--ch-ear, #ffd1dc)";
const BLUSH = "var(--ch-blush, #ffb4c4)";
const HINT = "#a8b6d1";

/** 실루엣 바깥으로 번지는 테두리 두께. 위아래 두 겹이 같은 값을 쓴다. */
const OUTLINE = 8;

function Stroke({
  d,
  width = 3.4,
  color = EYE,
}: {
  d: string;
  width?: number;
  color?: string;
}) {
  return (
    <path
      d={d}
      stroke={color}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * 얼굴을 키워 가운데로 옮기는 변환. 얼굴 좌표는 머리 반지름이 32일 때 짜 두었다.
 * 좌표를 전부 다시 적는 대신 묶음째 키운다. 둘레에 소품 자리를 남긴다.
 */
const HEAD_SCALE = 1.1;
const HEAD = `translate(60 66) scale(${HEAD_SCALE}) translate(-60 -46)`;

/**
 * 도형 묶음에 바깥 테두리만 두른다. 같은 그림을 굵은 선으로 한 번, 크림색으로 한 번
 * 그린다. 귀와 얼굴이 만나는 곳에 선이 남지 않는다.
 */
function Outlined({ children }: { children: ReactNode }) {
  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={OUTLINE} strokeLinejoin="round">
        {children}
      </g>
      <g fill={BODY}>{children}</g>
    </>
  );
}

/**
 * 도리를 뺀 캐릭터마다 달라지는 것: 머리 뒤(귀), 윤곽을 두를 머리 모양, 머리 위(코·무늬·부리). 눈·입은 표정(LOOKS)이 그린다.
 * 도리는 머리 모양이 달라 아래 DoriHead가 따로 그린다.
 */
const SHAPES: Record<Exclude<CharacterId, "dori">, { behind?: ReactNode; shape: ReactNode; front?: ReactNode }> = {
  // 몽이(강아지): 축 처진 갈색 귀, 한쪽 눈 둘레 얼룩, 동그란 코.
  mong: {
    behind: (
      <>
        <g fill={INK} stroke={INK} strokeWidth={7.3} strokeLinejoin="round">
          <ellipse cx={30} cy={44} rx={11} ry={21} transform="rotate(14 30 44)" />
          <ellipse cx={90} cy={44} rx={11} ry={21} transform="rotate(-14 90 44)" />
        </g>
        <ellipse cx={30} cy={44} rx={11} ry={21} transform="rotate(14 30 44)" fill={EAR} />
        <ellipse cx={90} cy={44} rx={11} ry={21} transform="rotate(-14 90 44)" fill={EAR} />
      </>
    ),
    shape: <circle cx={60} cy={46} r={32} />,
    front: (
      <>
        <ellipse cx={77} cy={46} rx={11} ry={12} fill={EAR} opacity={0.85} />
        <ellipse cx={60} cy={57.5} rx={14} ry={10} fill="#fffaf2" />
      </>
    ),
  },
  // 하루(여우): 큰 뾰족 귀(귀 안쪽 끝을 머리 꼭대기까지 이어 귀 사이에 머리가 튀어나오지 않게 한다. 안쪽은 크림색, 끝은 짙은 갈색), 하얀 아랫얼굴. 무늬는 이 정도로만 둔다(많으면 얼굴이 어수선하다).
  haru: {
    shape: (
      <>
        <path d="M36 29 L28 2 Q48 5 60 14 Z" />
        <path d="M84 29 L92 2 Q72 5 60 14 Z" />
        <circle cx={60} cy={46} r={32} />
      </>
    ),
    front: (
      <>
        <path d="M39.5 24 L34.5 9.5 Q43 12 50 20.5 Z" fill="#fff1dc" />
        <path d="M80.5 24 L85.5 9.5 Q77 12 70 20.5 Z" fill="#fff1dc" />
        <path d="M30 6.5 L28 2 Q39 3.7 47.6 7.1 Q38 8.2 30 6.5Z" fill="#5b3a2e" stroke="#5b3a2e" strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M90 6.5 L92 2 Q81 3.7 72.4 7.1 Q82 8.2 90 6.5Z" fill="#5b3a2e" stroke="#5b3a2e" strokeWidth={1.4} strokeLinejoin="round" />
        {/* 하얀 아랫얼굴: 머리 원 안쪽에서 끊어 윤곽 밖으로 번지지 않게 한다. */}
        <path d="M32.3 62 Q44 52 60 60.5 Q76 52 87.7 62 A32 32 0 0 1 32.3 62Z" fill="#fffaf2" />
      </>
    ),
  },
  // 펭이(펭귄): 통통한 남색 얼굴, 하트 모양 하얀 얼굴 무늬.
  peng: {
    shape: <ellipse cx={60} cy={47} rx={34} ry={31} />,
    front: (
      <>
        <g fill="#fffaf2">
          <circle cx={46} cy={50} r={17} />
          <circle cx={74} cy={50} r={17} />
          <ellipse cx={60} cy={60} rx={23} ry={14} />
        </g>
        <ellipse cx={37} cy={60} rx={7.5} ry={5.2} fill="#ffb8c6" opacity={0.9} />
        <ellipse cx={83} cy={60} rx={7.5} ry={5.2} fill="#ffb8c6" opacity={0.9} />
      </>
    ),
  },
};

/** 캐릭터마다 다른 색. 도리는 기본값(코드 위쪽 상수)이라 적지 않는다. */
const PALETTES: Partial<Record<CharacterId, CSSProperties>> = {
  mong: { "--ch-ink": "#a07a5a", "--ch-body": "#fff6e8", "--ch-ear": "#c98f5f", "--ch-blush": "#ffd9d0" } as CSSProperties,
  haru: { "--ch-ink": "#cf6f26", "--ch-body": "#ffa65c", "--ch-ear": "#5b3a2e", "--ch-blush": "#ffc4a3" } as CSSProperties,
  peng: { "--ch-ink": "#2f3b5c", "--ch-body": "#566a9c", "--ch-ear": "#ffb13d", "--ch-blush": "#ffb8c6" } as CSSProperties,
};

/**
 * 도리의 얼굴. 눈·코·입·볼은 머리를 그린 좌표(120×120, 머리 가운데 (60, 62))로 적고 DORI_FIT이 한꺼번에 줄여 놓는다.
 * 눈을 크고 낮게(아기 비율) 두고 눈 사이를 넓혀 둥글고 순해 보이게 했다(2026-10-31 운영자 요청: 도리가 못생겼다).
 */
const DORI_EYE = "#2b3a67";
const DORI_PINK = "#ff8fa8";

/** 도리 그림 전체를 줄여 둘레 소품 자리를 남기는 변환. 머리 가운데 (60, 62)를 (60, 66)으로 옮긴다. */
const DORI_SCALE = 0.9;
const DORI_FIT = `translate(60 66) scale(${DORI_SCALE}) translate(-60 -62)`;

function DoriStroke({ d, width = 3 }: { d: string; width?: number }) {
  return <Stroke d={d} width={width} color={DORI_EYE} />;
}

/** 큰 눈. 하이라이트 둘(크고 작은 것)로 눈이 반짝인다. */
const BigEye = ({ x, y = 57, rx = 6.6, ry = 8.2 }: { x: number; y?: number; rx?: number; ry?: number }) => (
  <>
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={DORI_EYE} />
    <circle cx={x + 2.6} cy={y - 3.4} r={2.6} fill="#fff" />
    <circle cx={x - 2} cy={y + 3.5} r={1.2} fill="#fff" opacity={0.9} />
  </>
);

/** 웃어서 감은 눈. */
const DoriArcEye = ({ x }: { x: number }) => <DoriStroke d={`M${x - 7} 61 Q${x} 50 ${x + 7} 61`} width={4} />;

const DoriSleepyEye = ({ x }: { x: number }) => <DoriStroke d={`M${x - 7} 54 Q${x} 62 ${x + 7} 54`} width={4} />;

const DoriStarEye = ({ x }: { x: number }) => (
  <path
    d={`M${x} 48 l2.8 5.8 6.3 .8 -4.7 4.3 1.3 6.2 -5.7 -3.2 -5.7 3.2 1.3 -6.2 -4.7 -4.3 6.3 -.8z`}
    fill={DORI_EYE}
  />
);

/** 눈꼬리를 올린 눈(불꽃 표정). dir이 -1이면 왼쪽, 1이면 오른쪽. */
function DoriSharpEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <DoriStroke d={`M${x + 8 * dir} 43 L${x - 7 * dir} 49`} width={3.6} />
      <BigEye x={x} y={59} rx={5.8} ry={7.2} />
    </>
  );
}

/** 눈꼬리를 내린 눈. */
function DoriSadEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <DoriStroke d={`M${x + 8 * dir} 48 L${x - 7 * dir} 43`} width={3.4} />
      <BigEye x={x} y={59} rx={6} ry={7.6} />
    </>
  );
}

const Nose = () => <path d="M57.4 62.6 h5.2 q0 3 -2.6 3.4 q-2.6 -0.4 -2.6 -3.4 z" fill={DORI_PINK} />;

/** 코와 ω 입. 고양이다움은 여기서 나온다. */
const NoseMouth = () => (
  <>
    <Nose />
    <DoriStroke d="M60 66 q-1 5 -6 4.4 M60 66 q1 5 6 4.4" width={2.6} />
  </>
);

function DoriOpenMouth() {
  return (
    <>
      <Nose />
      <ellipse cx={60} cy={73} rx={6} ry={6.8} fill={DORI_EYE} />
      <ellipse cx={60} cy={77.4} rx={3.6} ry={2.6} fill={DORI_PINK} />
    </>
  );
}

function DoriGrinMouth() {
  return (
    <>
      <Nose />
      <path d="M52 67 Q60 80 68 67 Z" fill={DORI_EYE} stroke={DORI_EYE} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M55.4 73.4 Q60 70 64.6 73.4 Q60 77 55.4 73.4 Z" fill={DORI_PINK} />
    </>
  );
}

const Cheeks = () => (
  <>
    <ellipse cx={29} cy={67} rx={7} ry={4.6} fill={BLUSH} />
    <ellipse cx={91} cy={67} rx={7} ry={4.6} fill={BLUSH} />
  </>
);

/** 도리 얼굴 한 벌: 볼 위에 표정(눈·입)을 얹는다. */
function DoriFace({ children }: { children: ReactNode }) {
  return (
    <>
      <Cheeks />
      {children}
    </>
  );
}

const HEART =
  "M105 12 c-4.2 -7.4 -14.4 -3.2 -11.2 5.1 L105 28 l11.2 -10.9 c3.2 -8.3 -7 -12.5 -11.2 -5.1z";

/**
 * 고깔모자. 두 귀 사이 정수리에 얹고 살짝 기울인다. 밑변을 귀 안쪽 사이보다 좁게 잡아
 * 귀를 가리지 않는다. 쓰고 있는 물건이라 얼굴처럼 테두리를 두른다.
 */
function PartyHat() {
  const cone = "M50.5 33 L60 8 L69.5 33 Q60 37 50.5 33 Z";

  return (
    <g transform="rotate(10 60 33)">
      <path d={cone} fill="#8b7bff" />
      <path d="M57.34 15 L62.66 15 L64.18 19 L55.82 19 Z" fill="#ffd166" />
      <path d="M54.11 23.5 L65.89 23.5 L67.41 27.5 L52.59 27.5 Z" fill="#ffd166" />
      <path
        d={cone}
        fill="none"
        stroke={INK}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      <circle cx={60} cy={8} r={4.4} fill="#ff6b9a" stroke={INK} strokeWidth={3} />
    </g>
  );
}

/**
 * 불꽃. 바깥 주황 불길에 왼쪽으로 작은 혀가 하나 갈라지고, 안쪽에 노란 불씨가 선다.
 * 좌표는 밑 가운데가 (0, 0)이고 위로 36만큼 솟는다.
 */
function Flame({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 0 C-7.5 0 -11.5 -5.5 -11 -12.5 C-10.5 -18.5 -6 -21 -5.5 -28 C-2 -25 -0.5 -21.5 -0.8 -18 C2.5 -21.5 4 -28.5 1 -36 C8.5 -30 12 -21.5 11.5 -13 C11 -5 6.5 0 0 0 Z"
        fill="#ff7a3d"
      />
      <path
        d="M0 -2.5 C-4.5 -2.5 -6.5 -6 -6 -9.5 C-5.5 -13.5 -2 -15.5 -0.5 -20 C3 -16.5 6.5 -13 6 -9 C5.6 -5 3.5 -2.5 0 -2.5 Z"
        fill="#ffc83d"
      />
    </g>
  );
}

function Spark({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  const m = s * 0.28;

  return (
    <path
      d={`M${x} ${y - s} L${x + m} ${y - m} L${x + s} ${y} L${x + m} ${y + m} L${x} ${y + s} L${x - m} ${y + m} L${x - s} ${y} L${x - m} ${y - m} Z`}
      fill={fill}
    />
  );
}

/** 표정마다 얼굴과 둘레 소품을 따로 둔다. 소품은 얼굴 위에 그린다(모자는 머리에 얹힌다). */
const LOOKS: Record<
  DoriMood,
  { face: ReactNode; props?: ReactNode }
> = {
  happy: {
    face: (
      <DoriFace>
        <BigEye x={41} />
        <BigEye x={79} />
        <NoseMouth />
      </DoriFace>
    ),
  },
  like: {
    face: (
      <DoriFace>
        <DoriArcEye x={41} />
        <DoriArcEye x={79} />
        <NoseMouth />
      </DoriFace>
    ),
    props: (
      <path
        d="M105 12 c-4.2 -7.4 -14.4 -3.2 -11.2 5.1 L105 28 l11.2 -10.9 c3.2 -8.3 -7 -12.5 -11.2 -5.1z"
        fill="#ff6f95"
      />
    ),
  },
  fire: {
    face: (
      <DoriFace>
        <DoriSharpEye x={41} dir={-1} />
        <DoriSharpEye x={79} dir={1} />
        <DoriOpenMouth />
      </DoriFace>
    ),
    // 귀에 닿지 않게 오른쪽 위 모서리에 세운다.
    props: <Flame x={105} y={40} />,
  },
  clap: {
    face: (
      <DoriFace>
        <DoriStarEye x={41} />
        <DoriStarEye x={79} />
        <DoriOpenMouth />
      </DoriFace>
    ),
    props: (
      <>
        <Spark x={14} y={22} s={6} fill="#ffc83d" />
        <Spark x={108} y={26} s={5} fill="#ffc83d" />
        <Spark x={110} y={62} s={4} fill="#8b7bff" />
      </>
    ),
  },
  party: {
    face: (
      <DoriFace>
        <DoriArcEye x={41} />
        <DoriArcEye x={79} />
        <DoriOpenMouth />
      </DoriFace>
    ),
    props: (
      <>
        <rect
          x={12}
          y={30}
          width={7}
          height={7}
          rx={2}
          fill="#ff6b9a"
          transform="rotate(20 15 33)"
        />
        <rect
          x={102}
          y={60}
          width={7}
          height={7}
          rx={2}
          fill="#ffc83d"
          transform="rotate(-25 105 63)"
        />
        <circle cx={108} cy={36} r={3.4} fill="#4d9bff" />
        <circle cx={13} cy={62} r={3.4} fill="#8b7bff" />
        <PartyHat />
      </>
    ),
  },
  calm: {
    face: (
      <DoriFace>
        <DoriSleepyEye x={41} />
        <DoriSleepyEye x={79} />
        <NoseMouth />
      </DoriFace>
    ),
    props: (
      <>
        <Stroke d="M99 22 L111 22 L99 36 L111 36" width={4} color={HINT} />
        <Stroke d="M108 7 L116 7 L108 16 L116 16" width={3.2} color="#c4cfe4" />
      </>
    ),
  },
  sad: {
    face: (
      <DoriFace>
        <DoriSadEye x={41} dir={-1} />
        <DoriSadEye x={79} dir={1} />
        <Nose />
        <DoriStroke d="M54 73 Q60 66.5 66 73" width={3} />
        <path d="M41 66 q-4.5 6.5 0 9 q4.5 -2.5 0 -9z" fill="#7cc8ff" />
      </DoriFace>
    ),
  },
  confused: {
    face: (
      <DoriFace>
        <BigEye x={41} />
        <ellipse cx={79} cy={58} rx={3.8} ry={4.8} fill={DORI_EYE} />
        <Nose />
        <DoriStroke d="M54 71 Q57 67 60 70 Q63 73 66 69" width={3} />
      </DoriFace>
    ),
    props: (
      <>
        <Stroke
          d="M99 20 C99 11 108 9 113 14 C117 19 112 24 108 27 L108 31"
          width={4.5}
          color={HINT}
        />
        <circle cx={108} cy={38} r={2.8} fill={HINT} />
      </>
    ),
  },
  hello: {
    face: (
      <DoriFace>
        <BigEye x={41} />
        <BigEye x={79} />
        <DoriOpenMouth />
      </DoriFace>
    ),
    // 몸은 없어도 흔드는 앞발 하나면 인사로 읽힌다. 얼굴 옆 볼 높이에 띄운다.
    props: (
      <>
        <Outlined>
          <ellipse cx={104} cy={70} rx={9} ry={10} transform="rotate(20 104 70)" />
        </Outlined>
        <g fill={EAR}>
          <circle cx={100} cy={66} r={1.9} />
          <circle cx={104} cy={64.5} r={1.9} />
          <circle cx={108} cy={66.5} r={1.9} />
          <ellipse cx={104} cy={72} rx={3.6} ry={2.8} />
        </g>
        <Stroke d="M106 49 q5 3 6 9" width={3} color={HINT} />
        <Stroke d="M110 44 q6 5 6 13" width={3} color={HINT} />
      </>
    ),
  },
  cool: {
    face: (
      <DoriFace>
        <DoriStroke d="M31 52 L89 52" width={3} />
        <path d="M30 50 H52 V58 Q52 68.5 41 68.5 Q30 68.5 30 58 Z" fill="#2b3a67" />
        <path d="M68 50 H90 V58 Q90 68.5 79 68.5 Q68 68.5 68 58 Z" fill="#2b3a67" />
        <Stroke d="M35 56 L39.5 52.5" width={2.2} color="#ffffff" />
        <Stroke d="M73 56 L77.5 52.5" width={2.2} color="#ffffff" />
        <Nose />
        <DoriStroke d="M53 71 Q60 76 67 70.5" width={3} />
      </DoriFace>
    ),
  },
  wow: {
    face: (
      <DoriFace>
        <BigEye x={41} rx={7.4} ry={9.2} />
        <BigEye x={79} rx={7.4} ry={9.2} />
        <Nose />
        <ellipse cx={60} cy={73} rx={4.2} ry={5.2} fill={DORI_EYE} />
      </DoriFace>
    ),
    props: (
      <>
        <Stroke d="M106 10 L106 26" width={5} color="#ffb13d" />
        <circle cx={106} cy={35} r={3} fill="#ffb13d" />
      </>
    ),
  },
  love: {
    face: (
      <DoriFace>
        <path d={HEART} fill="#ff6f95" transform="translate(41 58) scale(0.78) translate(-105 -18)" />
        <path d={HEART} fill="#ff6f95" transform="translate(79 58) scale(0.78) translate(-105 -18)" />
        <DoriGrinMouth />
      </DoriFace>
    ),
  },
};

/** 하치와레 무늬의 파란색. 머리 윗부분과 귀를 덮는다. 도리만 쓰는 색이라 팔레트(--ch-*)에 올리지 않는다. */
const DORI_CAP = "#8fb0ee";

const DORI_EARS = ["M17 52 Q10 14 33 12 Q50 13 53 31 Z", "M103 52 Q110 14 87 12 Q70 13 67 31 Z"];

/**
 * 하치와레(이마가 흰 세로 쐐기로 갈라진 얼굴) 무늬. 바깥 변은 머리 타원 위를 그대로 따라가
 * 윤곽 밖으로 번지지 않고, 안쪽 변은 눈 위에서 끊는다. clipPath는 화면에 안 그려진
 * <svg>에서 풀리는 브라우저가 있어 쓰지 않는다.
 */
const DORI_CAPS = [
  "M18.85 55 A42 35 0 0 1 56.3 27.1 L44 44 Q30 49 18.85 55 Z",
  "M101.15 55 A42 35 0 0 0 63.7 27.1 L76 44 Q90 49 101.15 55 Z",
];

/** 도리의 머리: 옆으로 넓은 모찌 모양에 크고 둥근 귀, 크림색 얼굴, 파란 하치와레 무늬. 몸 색은 팔레트(--ch-*)에서 온다. */
function DoriHead() {
  const shape = (
    <>
      {DORI_EARS.map((d) => (
        <path key={d} d={d} />
      ))}
      <ellipse cx={60} cy={62} rx={42} ry={35} />
    </>
  );

  return (
    <>
      <g fill={INK} stroke={INK} strokeWidth={OUTLINE / DORI_SCALE} strokeLinejoin="round">
        {shape}
      </g>
      <g fill={BODY}>{shape}</g>
      <g fill={DORI_CAP}>
        {DORI_EARS.map((d) => (
          <path key={d} d={d} />
        ))}
        {DORI_CAPS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d="M21 40 Q18 22 31 21 Q41 22 46 31 Z" fill={EAR} />
      <path d="M99 40 Q102 22 89 21 Q79 22 74 31 Z" fill={EAR} />
    </>
  );
}

/** 도리 말고 몽이·하루·펭이의 머리와 얼굴. 모두 같은 둥근 머리 틀(HEAD)에 모양만 바꿔 끼운다. */
function OtherHead({ character, mood }: { character: Exclude<CharacterId, "dori">; mood: CharacterMood }) {
  const parts = SHAPES[character];

  return (
    <>
      {parts.behind && (
        <g transform={HEAD} strokeWidth={OUTLINE / HEAD_SCALE}>
          {parts.behind}
        </g>
      )}
      <Outlined>
        <g transform={HEAD} strokeWidth={OUTLINE / HEAD_SCALE}>
          {parts.shape}
        </g>
      </Outlined>

      <g transform={HEAD}>
        {parts.front}
        {character !== "peng" && (
          <>
            <ellipse cx={40} cy={59} rx={8} ry={6} fill={BLUSH} />
            <ellipse cx={80} cy={59} rx={8} ry={6} fill={BLUSH} />
          </>
        )}
        <CharacterFace character={character} mood={mood} />
      </g>
    </>
  );
}

export function Dori({
  mood = "happy",
  size = 96,
  label,
  className,
  avatar = false,
  character = DEFAULT_CHARACTER,
}: {
  // 도리 표정(DoriMood) 또는 캐릭터마다의 개성 표정(lib/characters.ts의 SpecialMood).
  mood?: CharacterMood;
  size?: number;
  // 그림이 뜻을 전할 때만 이름을 붙인다. 꾸밀 뿐이면 화면 읽기에서 건너뛴다.
  label?: string;
  className?: string;
  // 프로필 사진 자리. 얼굴만 둥근 틀 가운데에 작게 두고 둘레 소품은 뺀다.
  avatar?: boolean;
  // 어느 캐릭터로 그릴지(lib/characters.ts). 기본은 도리.
  character?: CharacterId;
}) {
  // 도리 표정 목록에 없는 개성 표정이면 도리 소품(LOOKS)은 쓰지 않고 캐릭터 소품만 그린다.
  const isDoriMood = mood in LOOKS;
  const look = LOOKS[(isDoriMood ? mood : "happy") as DoriMood];

  return (
    <svg
      width={size}
      height={size}
      // 얼굴(귀 포함)은 가로 16~104, 세로 17~106이다. 원 안에 60% 남짓 차도록 둘레를 넉넉히 준다.
      viewBox={avatar ? "-12 -10 144 144" : "0 0 120 120"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={PALETTES[character]}
    >
      {character === "dori" ? (
        <g transform={DORI_FIT}>
          <DoriHead />
          {look.face}
        </g>
      ) : (
        <OtherHead character={character} mood={mood} />
      )}

      {!avatar && isDoriMood && look.props}
      {!avatar && character !== "dori" && <CharacterProps mood={mood} />}
    </svg>
  );
}
