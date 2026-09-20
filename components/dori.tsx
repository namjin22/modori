// 모도리의 캐릭터 "도리". 작은 펭귄과 파란 스카프가 서비스의 새 표정이다.
// 직접 그린 그림이라 외부 저작권이나 표기 의무가 없다.
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

const INK = "#10253f";
const BODY = "#17324d";
const SHADE = "#0b1e33";
const BELLY = "#f8fbff";
const SCARF = "#2563eb";
const CHEEK = "#8fc8ff";
const TONGUE = "#ff8ca8";
const STAR =
  "l1.6 3.4 3.6.4 -2.7 2.4 .8 3.6 -3.3 -1.9 -3.3 1.9 .8 -3.6 -2.7 -2.4 3.6 -.4z";

function Stroke({ d, width = 2.8 }: { d: string; width?: number }) {
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

function DotEye({ x }: { x: number }) {
  return (
    <>
      <circle cx={x} cy={-1} r={4.2} fill={INK} />
      <circle cx={x + 1.3} cy={-2.5} r={1.3} fill="#fff" />
    </>
  );
}

function ArcEye({ x }: { x: number }) {
  return <Stroke d={`M${x - 5} 0 Q${x} -6 ${x + 5} 0`} />;
}

const Smile = () => <Stroke d="M-6.5 7 Q0 13 6.5 7" />;

function OpenSmile() {
  return (
    <>
      <path d="M-7.5 6 Q0 16.5 7.5 6 Z" fill={INK} />
      <path
        d="M-3.6 10.6 Q0 13.2 3.6 10.6"
        stroke={TONGUE}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

/** 표정마다 얼굴(몸 좌표계)과 소품(전체 좌표계)을 따로 둔다. */
const LOOKS: Record<
  DoriMood,
  { face: ReactNode; props?: ReactNode; behind?: ReactNode }
> = {
  happy: {
    face: (
      <>
        <DotEye x={-11} />
        <DotEye x={11} />
        <Smile />
      </>
    ),
  },
  like: {
    face: (
      <>
        <DotEye x={-11} />
        <ArcEye x={11} />
        <Smile />
      </>
    ),
    props: (
      <path
        d="M92 22 c-4 -7 -14 -3 -11 5 l11 11 l11 -11 c3 -8 -7 -12 -11 -5z"
        fill="#ff5a7a"
      />
    ),
  },
  fire: {
    face: (
      <>
        <Stroke d="M-15 -4 L-7 -1 L-15 2" />
        <Stroke d="M15 -4 L7 -1 L15 2" />
        <OpenSmile />
      </>
    ),
    behind: (
      <>
        <path
          d="M60 10 C70 20 74 26 70 36 C68 30 64 28 62 28 C66 36 60 42 54 40 C48 38 48 30 52 24 C50 30 54 32 56 30 C54 22 56 16 60 10Z"
          fill="#ff7a2f"
        />
        <path d="M60 24 C65 30 64 36 60 38 C56 37 55 33 58 29Z" fill="#ffd166" />
      </>
    ),
  },
  clap: {
    face: (
      <>
        <path d={`M-11 -7 ${STAR}`} fill={INK} />
        <path d={`M11 -7 ${STAR}`} fill={INK} />
        <OpenSmile />
      </>
    ),
    props: (
      <>
        <path d="M16 26 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#ffc83d" />
        <path d="M101 44 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffc83d" />
        <path d="M96 16 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5z" fill="#7cc8ff" />
      </>
    ),
  },
  party: {
    face: (
      <>
        <ArcEye x={-11} />
        <ArcEye x={11} />
        <OpenSmile />
      </>
    ),
    props: (
      <>
        <path d="M44 34 L60 2 L76 34 Z" fill="#8b7bff" />
        <path d="M50 22 L70 22" stroke="#ffd166" strokeWidth={3} />
        <circle cx={60} cy={3} r={4.5} fill="#ffd166" />
        <rect x={14} y={30} width={6} height={6} rx={1.5} fill="#ff5a7a" transform="rotate(20 17 33)" />
        <rect x={98} y={30} width={6} height={6} rx={1.5} fill="#3cb4ff" transform="rotate(-25 101 33)" />
        <circle cx={104} cy={60} r={3} fill="#ffc83d" />
        <circle cx={12} cy={58} r={3} fill="#60a5fa" />
      </>
    ),
  },
  calm: {
    face: (
      <>
        <Stroke d="M-16 -1 Q-11 3 -6 -1" />
        <Stroke d="M6 -1 Q11 3 16 -1" />
        <Smile />
      </>
    ),
    behind: (
      <>
        <path d="M60 32 C60 26 60 22 60 16" stroke="#2563eb" strokeWidth={3} strokeLinecap="round" />
        <path d="M60 22 C52 14 44 18 44 22 C50 26 56 26 60 22Z" fill="#7fb3e8" />
        <path d="M60 20 C68 12 77 16 77 20 C71 25 64 25 60 20Z" fill="#7fb3e8" />
      </>
    ),
  },
  sad: {
    face: (
      <>
        <DotEye x={-11} />
        <DotEye x={11} />
        <Stroke d="M-6.5 11 Q0 5 6.5 11" />
      </>
    ),
    props: <path d="M42 76 q-3.5 6 0 8 q3.5 -2 0 -8z" fill="#7cc8ff" />,
  },
  confused: {
    face: (
      <>
        <DotEye x={-11} />
        <circle cx={11} cy={-1} r={2.6} fill={INK} />
        <Stroke d="M-7 9 Q-3.5 6 0 9 Q3.5 12 7 9" />
      </>
    ),
    props: (
      <text x={92} y={36} fontSize={30} fontWeight={800} fill="#8b95a1" fontFamily="sans-serif">
        ?
      </text>
    ),
  },
  hello: {
    face: (
      <>
        <ArcEye x={-11} />
        <ArcEye x={11} />
        <OpenSmile />
      </>
    ),
    props: (
      <>
        <path d="M84 8 h26 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-16 l-6 6 v-6 h-4 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6z" fill="#fff" stroke="#d6dbe0" strokeWidth={1.5} />
        <text x={97} y={25} fontSize={11} fontWeight={800} fill={INK} textAnchor="middle" fontFamily="sans-serif">
          hi!
        </text>
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
      <g transform="translate(60 70) scale(1.06)">
        <ellipse cx={0} cy={-5} rx={38} ry={47} fill={SHADE} />
        <ellipse cx={0} cy={-8} rx={34} ry={42} fill={BODY} />
        <ellipse cx={0} cy={13} rx={24} ry={29} fill={BELLY} />
        <path d="M-27 14 Q0 27 27 14 L24 23 Q0 35 -24 23Z" fill={SCARF} />
        <path d="M-31 0 Q-46 8 -35 25 Q-28 20 -23 12Z" fill={SHADE} />
        <path d="M31 0 Q46 8 35 25 Q28 20 23 12Z" fill={SHADE} />
        <path d="M-7 4 L0 10 L7 4 L0 1Z" fill="#ffb84d" />
        <ellipse cx={-17} cy={38} rx={12} ry={5} fill="#ffb84d" />
        <ellipse cx={17} cy={38} rx={12} ry={5} fill="#ffb84d" />
        <ellipse cx={-22} cy={-31} rx={7} ry={4} fill="#fff" opacity={0.55} transform="rotate(-35 -22 -31)" />
        <ellipse cx={-20} cy={9} rx={5.5} ry={3.3} fill={CHEEK} opacity={0.75} />
        <ellipse cx={20} cy={9} rx={5.5} ry={3.3} fill={CHEEK} opacity={0.75} />
        {look.face}
      </g>
      {look.props}
    </svg>
  );
}
