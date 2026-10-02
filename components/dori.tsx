// 모도리의 캐릭터 "도리". 크림색 얼굴에 파르스름한 굵은 테두리를 두른 고양이 얼굴이다.
// 몸통을 붙이면 작게 줄였을 때 비율이 어색해져서 얼굴만 그린다. 표정은 눈·입과
// 둘레의 소품으로만 전한다.
// 직접 그린 그림이라 외부 저작권이나 표기 의무가 없다.
//
// 테두리는 도형마다 그리지 않는다. 같은 실루엣을 두 번 그려서 아래 겹은 굵은 선으로
// 부풀리고 위 겹을 크림색으로 덮는다. 이렇게 해야 도형이 겹치는 안쪽에는 선이 남지
// 않고 바깥 윤곽만 고르게 두꺼워진다.
//
// 얼굴이 크림색이라 파랑 버튼 옆에 두어도 브랜드 색과 싸우지 않고, 다크 모드에서도
// 배경에서 떠오른다. 24px(반응 줄)까지 줄어들기 때문에 눈·입은 크고 단순하게 그린다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.

import type { CSSProperties, ReactNode } from "react";

import { DEFAULT_CHARACTER, type CharacterId } from "@/lib/characters";

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
const INK = "var(--ch-ink, #6e82ad)";
const BODY = "var(--ch-body, #fdfbf7)";
const EYE = "#5d6f96";
const EAR = "var(--ch-ear, #ffd0dc)";
const BLUSH = "var(--ch-blush, #ffdbe4)";
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

/** 캐릭터마다 달라지는 것: 머리 뒤(귀), 윤곽을 두를 머리 모양, 머리 위(코·무늬·부리). 눈·입은 표정(LOOKS)이 그린다. */
const SHAPES: Record<CharacterId, { behind?: ReactNode; shape: ReactNode; front?: ReactNode }> = {
  dori: {
    shape: (
      <>
        <path d="M40 25 L35 9 Q48 11 55 21 Z" />
        <path d="M80 25 L85 9 Q72 11 65 21 Z" />
        <circle cx={60} cy={46} r={32} />
      </>
    ),
    front: (
      <>
        {/* 귀 안쪽. 귀 삼각형을 가운데로 45% 줄인 모양이다. 타원으로 그리면 귀를 거의 다 덮어 귀 전체가 분홍으로 보였다. */}
        <path d="M41.8 21.3 L39.6 14.1 L48.6 19.5 Z" fill={EAR} stroke={EAR} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M78.2 21.3 L80.4 14.1 L71.4 19.5 Z" fill={EAR} stroke={EAR} strokeWidth={1.6} strokeLinejoin="round" />
      </>
    ),
  },
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
        <ellipse cx={74} cy={44} rx={11} ry={12} fill={EAR} opacity={0.85} />
        <ellipse cx={60} cy={55} rx={11} ry={8} fill="#fffaf2" />
        <ellipse cx={60} cy={49.6} rx={4.6} ry={3.4} fill="#5b4636" />
        <circle cx={58.6} cy={48.5} r={1} fill="#fff" />
      </>
    ),
  },
  // 하루(여우): 뾰족하고 큰 귀(끝이 짙다), 하얀 볼 털, 까만 코.
  haru: {
    shape: (
      <>
        <path d="M36 28 L30 4 Q47 8 56 22 Z" />
        <path d="M84 28 L90 4 Q73 8 64 22 Z" />
        <circle cx={60} cy={46} r={32} />
      </>
    ),
    front: (
      <>
        <path d="M32.2 11.5 L30 4 Q38.5 6 44.5 12.5 Z" fill="#5b3a2e" stroke="#5b3a2e" strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M87.8 11.5 L90 4 Q81.5 6 75.5 12.5 Z" fill="#5b3a2e" stroke="#5b3a2e" strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M28 51 Q29 69 50 72 Q40 62 45 51 Z" fill="#fffaf2" />
        <path d="M92 51 Q91 69 70 72 Q80 62 75 51 Z" fill="#fffaf2" />
        <ellipse cx={60} cy={52} rx={4.2} ry={3} fill="#3d2b25" />
      </>
    ),
  },
  // 펭이(펭귄): 남색 머리에 하얀 얼굴 무늬, 주황 부리, 머리 위 깃털 세 가닥.
  peng: {
    shape: <circle cx={60} cy={46} r={32} />,
    front: (
      <>
        <path d="M56 14 Q54 6 59 4 M60 14 Q61 5 66 6 M64 14 Q68 8 72 10" stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
        <g fill="#fffaf2">
          <circle cx={47} cy={49} r={16} />
          <circle cx={73} cy={49} r={16} />
          <ellipse cx={60} cy={58} rx={21} ry={13} />
        </g>
        <ellipse cx={39} cy={59} rx={7} ry={5} fill="#ffb8c6" opacity={0.85} />
        <ellipse cx={81} cy={59} rx={7} ry={5} fill="#ffb8c6" opacity={0.85} />
      </>
    ),
  },
};

/** 부리는 입 위에 얹는다(입이 부리 아래로 보인다). 펭귄만. */
function Beak() {
  return (
    <path
      d="M52.5 52.5 Q60 49 67.5 52.5 Q64 61.5 60 62.5 Q56 61.5 52.5 52.5 Z"
      fill={EAR}
      stroke="#e68a1f"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** 캐릭터마다 다른 색. 도리는 기본값(코드 위쪽 상수)이라 적지 않는다. */
const PALETTES: Partial<Record<CharacterId, CSSProperties>> = {
  mong: { "--ch-ink": "#a07a5a", "--ch-body": "#fff6e8", "--ch-ear": "#c98f5f", "--ch-blush": "#ffd9d0" } as CSSProperties,
  haru: { "--ch-ink": "#d4772f", "--ch-body": "#ffb877", "--ch-ear": "#5b3a2e", "--ch-blush": "#ff9a7a" } as CSSProperties,
  peng: { "--ch-ink": "#2f3b5c", "--ch-body": "#4a5a85", "--ch-ear": "#ffb13d", "--ch-blush": "#ffb8c6" } as CSSProperties,
};

const DotEye = ({ x }: { x: number }) => (
  <>
    <ellipse cx={x} cy={46} rx={6} ry={7.5} fill={EYE} />
    {/* 반짝임 하나로 눈이 살아난다. 없으면 인형 눈처럼 멍해 보인다. */}
    <circle cx={x + 2} cy={42.5} r={2.1} fill="#fff" />
  </>
);

/** 웃어서 감은 눈. */
const ArcEye = ({ x }: { x: number }) => (
  <Stroke d={`M${x - 7} 49 Q${x} 39 ${x + 7} 49`} width={4} />
);

const SleepyEye = ({ x }: { x: number }) => (
  <Stroke d={`M${x - 7} 43 Q${x} 51 ${x + 7} 43`} width={4} />
);

const StarEye = ({ x }: { x: number }) => (
  <path
    d={`M${x} 38 l2.6 5.4 5.9 .7 -4.4 4 1.2 5.8 -5.3 -3 -5.3 3 1.2 -5.8 -4.4 -4 5.9 -.7z`}
    fill={EYE}
  />
);

/** 눈꼬리를 올린 눈. dir이 -1이면 왼쪽, 1이면 오른쪽. */
function SharpEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <Stroke d={`M${x + 7 * dir} 34 L${x - 6 * dir} 39`} width={3.4} />
      <ellipse cx={x} cy={48} rx={5.4} ry={6.6} fill={EYE} />
      <circle cx={x + 1.8} cy={45} r={1.9} fill="#fff" />
    </>
  );
}

/** 눈꼬리를 내린 눈. */
function SadEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <Stroke d={`M${x + 7 * dir} 37 L${x - 6 * dir} 34`} width={3.2} />
      <ellipse cx={x} cy={48} rx={5.6} ry={7} fill={EYE} />
      <circle cx={x + 1.8} cy={45} r={1.9} fill="#fff" />
    </>
  );
}

// 입꼬리만 살짝 올린 웃는 입. 기본 표정이다.
const SmileMouth = () => <Stroke d="M53.5 55 Q60 62 66.5 55" width={3.4} />;

const CatMouth = () => (
  <Stroke d="M54 55 Q57 60 60 55 Q63 60 66 55" width={3.2} />
);

const WavyMouth = () => (
  <Stroke d="M54 58 Q57 54 60 57 Q63 60 66 56" width={3.2} />
);

const FrownMouth = () => <Stroke d="M55 61 Q60 55 65 61" width={3.2} />;

function OpenMouth() {
  return (
    <>
      <ellipse cx={60} cy={58} rx={7} ry={8.5} fill={EYE} />
      <ellipse cx={60} cy={63} rx={4} ry={3} fill="#ff8fb0" />
    </>
  );
}

/** 활짝 벌린 웃는 입. 아래가 둥근 반달에 혀를 얹는다. */
function GrinMouth() {
  return (
    <>
      <path
        d="M52.5 55 Q60 67 67.5 55 Z"
        fill={EYE}
        stroke={EYE}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <path d="M55.6 61 Q60 57.6 64.4 61 Q60 64.6 55.6 61 Z" fill="#ff8fb0" />
    </>
  );
}

const HEART =
  "M105 12 c-4.2 -7.4 -14.4 -3.2 -11.2 5.1 L105 28 l11.2 -10.9 c3.2 -8.3 -7 -12.5 -11.2 -5.1z";

/** 하트 눈. 좋아요의 하트 소품과 같은 모양을 눈 크기로 줄인다. */
const HeartEye = ({ x }: { x: number }) => (
  <path
    d={HEART}
    fill="#ff6f95"
    transform={`translate(${x} 46.5) scale(0.66) translate(-105 -18)`}
  />
);

/** 눈 둘을 가리는 선글라스. 알 위의 흰 빗금이 유리처럼 보이게 한다. */
function Sunglasses() {
  return (
    <>
      <Stroke d="M29 41.5 L91 41.5" width={3} color="#2f3850" />
      <path d="M34.5 39 H57.5 V45 Q57.5 54.5 46 54.5 Q34.5 54.5 34.5 45 Z" fill="#2f3850" />
      <path d="M62.5 39 H85.5 V45 Q85.5 54.5 74 54.5 Q62.5 54.5 62.5 45 Z" fill="#2f3850" />
      <Stroke d="M39 43.5 L43 40.5" width={2.2} color="#ffffff" />
      <Stroke d="M67 43.5 L71 40.5" width={2.2} color="#ffffff" />
    </>
  );
}

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
      <>
        <DotEye x={46} />
        <DotEye x={74} />
        <SmileMouth />
      </>
    ),
  },
  like: {
    face: (
      <>
        <ArcEye x={46} />
        <ArcEye x={74} />
        <CatMouth />
      </>
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
      <>
        <SharpEye x={46} dir={-1} />
        <SharpEye x={74} dir={1} />
        <OpenMouth />
      </>
    ),
    // 귀에 닿지 않게 오른쪽 위 모서리에 세운다.
    props: <Flame x={105} y={40} />,
  },
  clap: {
    face: (
      <>
        <StarEye x={46} />
        <StarEye x={74} />
        <OpenMouth />
      </>
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
      <>
        <ArcEye x={46} />
        <ArcEye x={74} />
        <OpenMouth />
      </>
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
      <>
        <SleepyEye x={46} />
        <SleepyEye x={74} />
        <CatMouth />
      </>
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
      <>
        <SadEye x={46} dir={-1} />
        <SadEye x={74} dir={1} />
        <FrownMouth />
        <path d="M46 58 q-4.5 6.5 0 9 q4.5 -2.5 0 -9z" fill="#7cc8ff" />
      </>
    ),
  },
  confused: {
    face: (
      <>
        <DotEye x={46} />
        <ellipse cx={74} cy={46} rx={3.4} ry={4.2} fill={EYE} />
        <WavyMouth />
      </>
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
      <>
        <DotEye x={46} />
        <DotEye x={74} />
        <OpenMouth />
      </>
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
      <>
        <Sunglasses />
        <Stroke d="M53 57.5 Q61 61.5 67.5 55" width={3.2} />
      </>
    ),
  },
  wow: {
    face: (
      <>
        <ellipse cx={46} cy={46} rx={7} ry={8.6} fill={EYE} />
        <ellipse cx={74} cy={46} rx={7} ry={8.6} fill={EYE} />
        <circle cx={48.4} cy={42} r={2.6} fill="#fff" />
        <circle cx={76.4} cy={42} r={2.6} fill="#fff" />
        <ellipse cx={60} cy={60} rx={4} ry={5} fill={EYE} />
      </>
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
      <>
        <HeartEye x={46} />
        <HeartEye x={74} />
        <GrinMouth />
      </>
    ),
  },
};

export function Dori({
  mood = "happy",
  size = 96,
  label,
  className,
  avatar = false,
  character = DEFAULT_CHARACTER,
}: {
  mood?: DoriMood;
  size?: number;
  // 그림이 뜻을 전할 때만 이름을 붙인다. 꾸밀 뿐이면 화면 읽기에서 건너뛴다.
  label?: string;
  className?: string;
  // 프로필 사진 자리. 얼굴만 둥근 틀 가운데에 작게 두고 둘레 소품은 뺀다.
  avatar?: boolean;
  // 어느 캐릭터로 그릴지(lib/characters.ts). 기본은 도리.
  character?: CharacterId;
}) {
  const look = LOOKS[mood];
  const parts = SHAPES[character];

  return (
    <svg
      width={size}
      height={size}
      // 얼굴(귀 포함)은 가로 21~99, 세로 17~106이다. 원 안에 60% 남짓 차도록 둘레를 넉넉히 준다.
      viewBox={avatar ? "-12 -10 144 144" : "0 0 120 120"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={PALETTES[character]}
    >
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
        {look.face}
        {character === "peng" && <Beak />}
      </g>

      {!avatar && look.props}
    </svg>
  );
}
