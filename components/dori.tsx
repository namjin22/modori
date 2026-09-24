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

import type { ReactNode } from "react";

export type DoriMood =
  | "happy"
  | "like"
  | "fire"
  | "clap"
  | "party"
  | "calm"
  | "sad"
  | "confused"
  | "hello";

const INK = "#6e82ad";
const BODY = "#fdfbf7";
const EYE = "#5d6f96";
const EAR = "#ffd0dc";
const BLUSH = "#ffdbe4";
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

/** 귀와 얼굴. 키운 만큼 선을 가늘게 줘서 테두리 굵기를 다른 그림과 맞춘다. */
function Head() {
  return (
    <g transform={HEAD} strokeWidth={OUTLINE / HEAD_SCALE}>
      <path d="M40 25 L35 9 Q48 11 55 21 Z" />
      <path d="M80 25 L85 9 Q72 11 65 21 Z" />
      <circle cx={60} cy={46} r={32} />
    </g>
  );
}

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

// 작은 ✕ 입. 이 캐릭터의 기본 표정이다.
const XMouth = () => (
  <>
    <Stroke d="M57 55 L63 59" width={3.2} />
    <Stroke d="M63 55 L57 59" width={3.2} />
  </>
);

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

function Spark({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  const m = s * 0.28;

  return (
    <path
      d={`M${x} ${y - s} L${x + m} ${y - m} L${x + s} ${y} L${x + m} ${y + m} L${x} ${y + s} L${x - m} ${y + m} L${x - s} ${y} L${x - m} ${y - m} Z`}
      fill={fill}
    />
  );
}

/** 표정마다 얼굴과 앞뒤 소품을 따로 둔다. */
const LOOKS: Record<
  DoriMood,
  { face: ReactNode; props?: ReactNode; behind?: ReactNode }
> = {
  happy: {
    face: (
      <>
        <DotEye x={46} />
        <DotEye x={74} />
        <XMouth />
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
    // 귀에 닿지 않게 오른쪽 위 모서리로 민다.
    behind: (
      <g transform="translate(5 2)">
        <path
          d="M102 6 C112 18 115 28 110 38 C108 31 105 29 103 29 C107 38 100 45 93 42 C87 39 88 30 92 24 C90 30 94 32 96 30 C94 20 97 13 102 6Z"
          fill="#ff9a4d"
        />
        <path
          d="M102 22 C107 28 106 35 102 37 C98 35 97 31 100 27Z"
          fill="#ffd166"
        />
      </g>
    ),
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
        {/* 고깔은 한쪽 귀에만 씌운다. 가운데에 씌우면 두 귀가 다 가려져 실루엣이 흐려진다. */}
        <path d="M64 24 L76 6 L88 24 Z" fill="#8b7bff" />
        <path d="M68 16 L84 16" stroke="#ffd166" strokeWidth={3.4} />
        <circle cx={76} cy={6} r={4.5} fill="#ffd166" />
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
};

export function Dori({
  mood = "happy",
  size = 96,
  label,
  className,
}: {
  mood?: DoriMood;
  size?: number;
  // 그림이 뜻을 전할 때만 이름을 붙인다. 꾸밈이면 화면 읽기에서 건너뛴다.
  label?: string;
  className?: string;
}) {
  const look = LOOKS[mood];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      {look.behind}

      <Outlined>
        <Head />
      </Outlined>

      <g transform={HEAD}>
        <ellipse
          cx={44}
          cy={18}
          rx={5}
          ry={6}
          fill={EAR}
          transform="rotate(-20 44 18)"
        />
        <ellipse
          cx={76}
          cy={18}
          rx={5}
          ry={6}
          fill={EAR}
          transform="rotate(20 76 18)"
        />
        <ellipse cx={40} cy={59} rx={8} ry={6} fill={BLUSH} />
        <ellipse cx={80} cy={59} rx={8} ry={6} fill={BLUSH} />
        {look.face}
      </g>

      {look.props}
    </svg>
  );
}
