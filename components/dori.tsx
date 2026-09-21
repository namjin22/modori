// 모도리의 캐릭터 "도리". 크림색 몸에 파르스름한 굵은 테두리를 두른 작은 고양이다.
// 직접 그린 그림이라 외부 저작권이나 표기 의무가 없다.
//
// 테두리는 도형마다 그리지 않는다. 같은 실루엣을 두 번 그려서 아래 겹은 굵은 선으로
// 부풀리고 위 겹을 크림색으로 덮는다. 이렇게 해야 도형이 겹치는 안쪽에는 선이 남지
// 않고 바깥 윤곽만 고르게 두꺼워진다.
//
// 몸이 크림색이라 파랑 버튼 옆에 두어도 브랜드 색과 싸우지 않고, 다크 모드에서도
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
const PAD = "#ffc3d2";
const HINT = "#a8b6d1";

/** 실루엣 바깥으로 번지는 테두리 두께. 위아래 두 겹이 같은 값을 쓴다. */
const OUTLINE = 8;

type Arms = "rest" | "wave" | "up";

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

/** 위로 든 앞발. dir이 1이면 오른쪽, -1이면 왼쪽. */
function RaisedArm({ dir }: { dir: 1 | -1 }) {
  const pivotX = 60 + dir * 33;
  const pawX = 60 + dir * 40;

  return (
    <>
      <rect
        x={pivotX - 7}
        y={46}
        width={14}
        height={40}
        rx={7}
        transform={`rotate(${dir * 18} ${pivotX} 63)`}
      />
      <circle cx={pawX} cy={44} r={8.5} />
    </>
  );
}

/**
 * 도형 묶음에 바깥 테두리만 두른다. 같은 그림을 굵은 선으로 한 번, 크림색으로 한 번
 * 그린다. 묶음끼리는 테두리가 따로 생기므로, 들어 올린 앞발처럼 몸 위에 겹쳐야
 * 하는 부분은 몸과 다른 묶음으로 그린다.
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

function Body() {
  return (
    <>
      <path d="M40 25 L35 9 Q48 11 55 21 Z" />
      <path d="M80 25 L85 9 Q72 11 65 21 Z" />
      <circle cx={60} cy={46} r={32} />
      {/* 몸통 바닥을 평평하게 둔다. 둥근 바닥에 발을 붙이면 발끼리 너무 벌어져
          이음매가 꺾이고, 좁히면 발 사이 홈이 테두리에 메워진다. */}
      <rect x={34} y={58} width={52} height={38} rx={16} />
      <ellipse cx={48} cy={94} rx={8.5} ry={8} />
      <ellipse cx={72} cy={94} rx={8.5} ry={8} />
    </>
  );
}

function PawPads({ x }: { x: number }) {
  return (
    <g fill={PAD}>
      <circle cx={x - 3.4} cy={41} r={1.8} />
      <circle cx={x + 0.4} cy={39.8} r={1.8} />
      <circle cx={x + 4} cy={41.4} r={1.8} />
      <ellipse cx={x} cy={46.5} rx={3.5} ry={2.7} />
    </g>
  );
}

const DotEye = ({ x }: { x: number }) => (
  <ellipse cx={x} cy={46} rx={6} ry={7.5} fill={EYE} />
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
    </>
  );
}

/** 눈꼬리를 내린 눈. */
function SadEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <Stroke d={`M${x + 7 * dir} 37 L${x - 6 * dir} 34`} width={3.2} />
      <ellipse cx={x} cy={48} rx={5.6} ry={7} fill={EYE} />
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

/** 표정마다 얼굴, 팔 자세, 앞뒤 소품을 따로 둔다. */
const LOOKS: Record<
  DoriMood,
  { face: ReactNode; arms?: Arms; props?: ReactNode; behind?: ReactNode }
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
    arms: "wave",
    face: (
      <>
        <ArcEye x={46} />
        <ArcEye x={74} />
        <CatMouth />
      </>
    ),
    props: (
      <path
        d="M100 14 c-4.2 -7.4 -14.4 -3.2 -11.2 5.1 L100 30 l11.2 -10.9 c3.2 -8.3 -7 -12.5 -11.2 -5.1z"
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
    behind: (
      <>
        <path
          d="M102 6 C112 18 115 28 110 38 C108 31 105 29 103 29 C107 38 100 45 93 42 C87 39 88 30 92 24 C90 30 94 32 96 30 C94 20 97 13 102 6Z"
          fill="#ff9a4d"
        />
        <path
          d="M102 22 C107 28 106 35 102 37 C98 35 97 31 100 27Z"
          fill="#ffd166"
        />
      </>
    ),
  },
  clap: {
    arms: "up",
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
        {/* 고깔은 한쪽 귀에만 씌운다. 가운데에 씌우면 두 귀가 다 가려져 실루엣이 흐려진다. */}
        <path d="M70 26 L82 8 L94 26 Z" fill="#8b7bff" />
        <path d="M74 18 L90 18" stroke="#ffd166" strokeWidth={3.4} />
        <circle cx={82} cy={8} r={4.5} fill="#ffd166" />
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
        <Stroke d="M92 18 L104 18 L92 32 L104 32" width={4} color={HINT} />
        <Stroke d="M106 6 L114 6 L106 15 L114 15" width={3.2} color="#c4cfe4" />
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
          d="M95 22 C95 13 104 11 109 16 C113 21 108 26 104 29 L104 33"
          width={4.5}
          color={HINT}
        />
        <circle cx={104} cy={40} r={2.8} fill={HINT} />
      </>
    ),
  },
  hello: {
    arms: "wave",
    face: (
      <>
        <DotEye x={46} />
        <DotEye x={74} />
        <OpenMouth />
      </>
    ),
    props: <Stroke d="M94 27 q6 -6 12 0" width={3} color={HINT} />,
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
  const arms = look.arms ?? "rest";

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

      {arms !== "rest" && (
        <Outlined>
          <RaisedArm dir={1} />
        </Outlined>
      )}
      {arms === "up" && (
        <Outlined>
          <RaisedArm dir={-1} />
        </Outlined>
      )}

      <Outlined>
        <Body />
      </Outlined>

      {arms !== "rest" && <PawPads x={100} />}
      {arms === "up" && <PawPads x={20} />}

      <ellipse
        cx={44}
        cy={18}
        rx={4.5}
        ry={5.5}
        fill={EAR}
        transform="rotate(-20 44 18)"
      />
      <ellipse
        cx={76}
        cy={18}
        rx={4.5}
        ry={5.5}
        fill={EAR}
        transform="rotate(20 76 18)"
      />
      <ellipse cx={42} cy={59} rx={9.5} ry={7.5} fill={BLUSH} />
      <ellipse cx={78} cy={59} rx={9.5} ry={7.5} fill={BLUSH} />

      {look.face}
      {look.props}
    </svg>
  );
}
