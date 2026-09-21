// 모도리의 캐릭터 "도리". 브랜드 파랑을 쓰는 작은 고양이다.
// 직접 그린 그림이라 외부 저작권이나 표기 의무가 없다.
// 귀 두 개로 실루엣이 잡혀서 24px로 줄여도 무엇인지 알아볼 수 있고,
// 눈과 입을 굵게 그려 작은 크기에서도 뭉개지지 않는다.
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

const INK = "#10305c";
const BODY = "#4d9bff";
const SHADE = "#2f7ae0";
const EAR = "#ffc2d4";
const CHEEK = "#ff9ec2";
const MUZZLE = "#eef6ff";
const HINT = "#93b8e8";
const STAR = "l2.3 4.8 5.2.6 -3.9 3.5 1.1 5.1 -4.7 -2.7 -4.7 2.7 1.1 -5.1 -3.9 -3.5 5.2 -.6z";

function Stroke({ d, width = 3.2 }: { d: string; width?: number }) {
  return (
    <path
      d={d}
      stroke={INK}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function DotEye({ x, r = 7 }: { x: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={-4} r={r} fill={INK} />
      <circle cx={x + 2.4} cy={-6.4} r={r / 2.9} fill="#fff" />
    </>
  );
}

const ArcEye = ({ x }: { x: number }) => (
  <Stroke d={`M${x - 7} -3 Q${x} -12 ${x + 7} -3`} width={3.4} />
);

const SleepyEye = ({ x }: { x: number }) => (
  <Stroke d={`M${x - 7} -5 Q${x} 2 ${x + 7} -5`} width={3.4} />
);

const StarEye = ({ x }: { x: number }) => (
  <path d={`M${x} -11 ${STAR}`} fill={INK} />
);

/** 눈꼬리를 올린 눈. dir이 1이면 왼쪽, -1이면 오른쪽. */
function SharpEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <Stroke d={`M${x - 7 * dir} -9 L${x + 6 * dir} -4`} />
      <circle cx={x + dir} cy={1} r={4.6} fill={INK} />
    </>
  );
}

// 고양이 입(ω).
const CatMouth = () => <Stroke d="M-7 12 Q-3.5 17 0 12 Q3.5 17 7 12" width={3} />;

function OpenMouth() {
  return (
    <>
      <path d="M-6.5 10 Q0 21 6.5 10 Z" fill={INK} />
      <path
        d="M-3 14.5 Q0 17 3 14.5"
        stroke="#ff8fb0"
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

/** 표정마다 얼굴(머리 좌표계)과 소품(전체 좌표계)을 따로 둔다. */
const LOOKS: Record<
  DoriMood,
  { face: ReactNode; props?: ReactNode; behind?: ReactNode }
> = {
  happy: {
    face: (
      <>
        <DotEye x={-14} />
        <DotEye x={14} />
        <CatMouth />
      </>
    ),
  },
  like: {
    face: (
      <>
        <DotEye x={-14} />
        <ArcEye x={14} />
        <CatMouth />
      </>
    ),
    props: (
      <path
        d="M96 26 c-4.5 -8 -15.5 -3.5 -12 5.5 l12 12 l12 -12 c3.5 -9 -7.5 -13.5 -12 -5.5z"
        fill="#ff5f8f"
      />
    ),
  },
  fire: {
    face: (
      <>
        <SharpEye x={-14} dir={1} />
        <SharpEye x={14} dir={-1} />
        <OpenMouth />
      </>
    ),
    behind: (
      <>
        <path
          d="M60 4 C71 15 75 22 71 33 C69 26 65 24 63 24 C67 33 60 39 53 37 C47 35 47 26 51 20 C49 26 53 28 55 26 C53 17 55 11 60 4Z"
          fill="#ff8a3d"
        />
        <path d="M60 19 C65 25 64 32 60 34 C56 33 55 29 58 25Z" fill="#ffd166" />
      </>
    ),
  },
  clap: {
    face: (
      <>
        <StarEye x={-14} />
        <StarEye x={14} />
        <OpenMouth />
      </>
    ),
    props: (
      <>
        <path d="M14 20 l2.6 6 6 2.6 -6 2.6 -2.6 6 -2.6 -6 -6 -2.6 6 -2.6z" fill="#ffc83d" />
        <path d="M104 44 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffc83d" />
        <path d="M100 14 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6z" fill="#8b7bff" />
      </>
    ),
  },
  party: {
    face: (
      <>
        <ArcEye x={-14} />
        <ArcEye x={14} />
        <OpenMouth />
      </>
    ),
    props: (
      <>
        {/* 고깔은 한쪽 귀에만 씌운다. 가운데에 씌우면 귀가 다 가려져 실루엣이 흐려진다. */}
        <g transform="rotate(-10 46 30)">
          <path d="M30 30 L46 0 L62 30 Z" fill="#8b7bff" />
          <path d="M36 18 L56 18" stroke="#ffd166" strokeWidth={3.4} />
          <circle cx={46} cy={0} r={5} fill="#ffd166" />
        </g>
        <rect x={10} y={28} width={7} height={7} rx={2} fill="#ff6b9a" transform="rotate(20 13 31)" />
        <rect x={104} y={30} width={7} height={7} rx={2} fill="#ffc83d" transform="rotate(-25 107 33)" />
        <circle cx={108} cy={62} r={3.4} fill={BODY} />
        <circle cx={10} cy={60} r={3.4} fill="#8b7bff" />
      </>
    ),
  },
  calm: {
    face: (
      <>
        <SleepyEye x={-14} />
        <SleepyEye x={14} />
        <CatMouth />
      </>
    ),
    props: (
      <>
        <text x={92} y={30} fontSize={16} fontWeight={800} fill={HINT} fontFamily="sans-serif">
          z
        </text>
        <text x={102} y={18} fontSize={11} fontWeight={800} fill="#b9d3f2" fontFamily="sans-serif">
          z
        </text>
      </>
    ),
  },
  sad: {
    face: (
      <>
        <Stroke d="M-21 -9 Q-14 -13 -7 -9" />
        <Stroke d="M7 -9 Q14 -13 21 -9" />
        <circle cx={-14} cy={-1} r={5.4} fill={INK} />
        <circle cx={14} cy={-1} r={5.4} fill={INK} />
        <Stroke d="M-6 16 Q0 10 6 16" width={3} />
      </>
    ),
    props: <path d="M40 74 q-4 6.5 0 8.5 q4 -2 0 -8.5z" fill="#7cc8ff" />,
  },
  confused: {
    face: (
      <>
        <DotEye x={-14} />
        <circle cx={14} cy={-4} r={3.4} fill={INK} />
        <Stroke d="M-7 13 Q-3.5 10 0 13 Q3.5 16 7 13" width={3} />
      </>
    ),
    props: (
      <text x={92} y={34} fontSize={30} fontWeight={800} fill={HINT} fontFamily="sans-serif">
        ?
      </text>
    ),
  },
  hello: {
    face: (
      <>
        <ArcEye x={-14} />
        <ArcEye x={14} />
        <OpenMouth />
      </>
    ),
    props: (
      <>
        {/* 흔드는 앞발. 얼굴을 가리지 않게 머리 오른쪽 바깥에 둔다. */}
        <g transform="translate(103 50) rotate(18)">
          <rect x={-8} y={0} width={16} height={30} rx={8} fill={SHADE} />
          <rect x={-8} y={0} width={16} height={22} rx={8} fill={BODY} />
          <circle cx={-3.5} cy={5} r={2.2} fill={EAR} />
          <circle cx={3.5} cy={5} r={2.2} fill={EAR} />
          <circle cx={0} cy={11} r={3} fill={EAR} />
        </g>
        <Stroke d="M112 34 q5 -5 9 0 M110 26 q7 -7 13 0" width={2.6} />
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
      <g transform="translate(60 66)">
        <path d="M-34 -18 L-30 -46 L-8 -32 Z" fill={SHADE} />
        <path d="M34 -18 L30 -46 L8 -32 Z" fill={SHADE} />
        <path d="M-29 -22 L-27 -38 L-14 -30 Z" fill={EAR} />
        <path d="M29 -22 L27 -38 L14 -30 Z" fill={EAR} />

        <circle cx={0} cy={2} r={36} fill={SHADE} />
        <circle cx={0} cy={0} r={35} fill={BODY} />
        <ellipse cx={0} cy={14} rx={20} ry={14} fill={MUZZLE} />
        <ellipse cx={-13} cy={-16} rx={8} ry={5} fill="#fff" opacity={0.45} transform="rotate(-25 -13 -16)" />
        <ellipse cx={-22} cy={9} rx={6.5} ry={4} fill={CHEEK} opacity={0.8} />
        <ellipse cx={22} cy={9} rx={6.5} ry={4} fill={CHEEK} opacity={0.8} />
        {look.face}
      </g>
      {look.props}
    </svg>
  );
}
