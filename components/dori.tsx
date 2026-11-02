// 모도리의 캐릭터 "도리". 연한 웜그레이 고양이 얼굴이다. 뾰족한 귀(안쪽 분홍), 이마의 줄무늬 셋, 크림색 아랫얼굴, 볼 수염에
// 하이라이트 없는 작은 점 눈을 둔다. 2026-11-02에 운영자가 보낸 참고 그림(굵은 짙은 갈색 선, 납작한 색칠)을 따라 다시 그렸다.
// 몸통을 붙이면 작게 줄였을 때 비율이 어색해져서 얼굴만 그린다. 표정은 눈·입과
// 둘레의 소품으로만 전한다.
// 직접 그린 그림이라 외부 저작권이나 표기 의무가 없다.
//
// 테두리는 도형마다 그리지 않는다. 같은 실루엣을 두 번 그려서 아래 겹은 굵은 선으로
// 부풀리고 위 겹을 몸 색으로 덮는다. 이렇게 해야 도형이 겹치는 안쪽에는 선이 남지
// 않고 바깥 윤곽만 고르게 두꺼워진다.
//
// 머리 모양은 components/character-heads.tsx, 도리의 표정(눈·코·입)은 이 파일이 그린다.
// 24px(반응 줄)까지 줄어들기 때문에 눈·입은 크고 단순하게 그린다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.

import type { CSSProperties, ReactNode } from "react";

import { CharacterFace, CharacterProps } from "@/components/character-face";
import { BODY, DoriHead, EAR, HaruHead, INK, MongHead, OUTLINE, WIDE_FIT } from "@/components/character-heads";
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

const EYE = "#5d6f96";
const HINT = "#a8b6d1";

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
 * 펭이의 머리: 윤곽을 두를 머리 모양과 머리 위(하얀 얼굴 무늬). 눈·부리는 표정이 그린다.
 * 도리·몽이·하루는 머리 모양이 달라 components/character-heads.tsx의 DoriHead·MongHead·HaruHead가 그린다.
 */
const PENG_HEAD: { shape: ReactNode; front: ReactNode } = {
  // 통통한 남색 얼굴, 하트 모양 하얀 얼굴 무늬.
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
};

/** 캐릭터마다 다른 색. 도리는 기본값(components/character-heads.tsx 위쪽 상수)이라 적지 않는다. 2026-11-02 참고 그림에서 뽑은 색이다. */
const PALETTES: Partial<Record<CharacterId, CSSProperties>> = {
  mong: { "--ch-ink": "#3d1f14", "--ch-body": "#f1cc92", "--ch-ear": "#b87a4a", "--ch-cream": "#fff8ea" } as CSSProperties,
  haru: {
    "--ch-ink": "#3a3945",
    "--ch-body": "#9c9084",
    "--ch-ear": "#8d6b5c",
    "--ch-cream": "#f2e6d6",
    "--ch-mask": "#786c60",
  } as CSSProperties,
  peng: { "--ch-ink": "#2f3b5c", "--ch-body": "#566a9c", "--ch-ear": "#ffb13d" } as CSSProperties,
};

/**
 * 도리의 얼굴. 눈·코·입은 머리를 그린 좌표(120×120, 머리 가운데 (60, 64))로 적고 WIDE_FIT이 한꺼번에 줄여 놓는다.
 * 참고 그림처럼 눈은 작은 민짜 점이고 눈높이는 머리 가운데보다 아래다(2026-11-02, 2026-10-31 "도리가 못생겼다" 요청 이후 세 번째 방향).
 */
const DORI_EYE = "#2f1a16";
const DORI_PINK = "#f08f8f";
const EY = 65;

function DoriStroke({ d, width = 3 }: { d: string; width?: number }) {
  return <Stroke d={d} width={width} color={DORI_EYE} />;
}

/** 작은 점 눈. 하이라이트 없이 짙은 갈색 한 가지다. */
const BigEye = ({ x, y = EY, rx = 4.8, ry = 5.6 }: { x: number; y?: number; rx?: number; ry?: number }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={DORI_EYE} />
);

/** 웃어서 감은 눈. */
const DoriArcEye = ({ x }: { x: number }) => <DoriStroke d={`M${x - 5.6} ${EY + 2.6} Q${x} ${EY - 5.6} ${x + 5.6} ${EY + 2.6}`} width={3.4} />;

const DoriSleepyEye = ({ x }: { x: number }) => <DoriStroke d={`M${x - 5.4} ${EY - 1.6} Q${x} ${EY + 4.8} ${x + 5.4} ${EY - 1.6}`} width={3.4} />;

const DoriStarEye = ({ x }: { x: number }) => (
  <path
    d="M0 -10 l2.8 5.8 6.3 .8 -4.7 4.3 1.3 6.2 -5.7 -3.2 -5.7 3.2 1.3 -6.2 -4.7 -4.3 6.3 -.8z"
    transform={`translate(${x} ${EY}) scale(0.8)`}
    fill={DORI_EYE}
  />
);

/** 눈꼬리를 올린 눈(불꽃 표정). dir이 -1이면 왼쪽, 1이면 오른쪽. */
function DoriSharpEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <DoriStroke d={`M${x + 6.6 * dir} ${EY - 10.5} L${x - 5.6 * dir} ${EY - 6.6}`} width={3} />
      <BigEye x={x} rx={4.4} ry={5.2} />
    </>
  );
}

/** 눈꼬리를 내린 눈. */
function DoriSadEye({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <>
      <DoriStroke d={`M${x + 6.6 * dir} ${EY - 6.6} L${x - 5.6 * dir} ${EY - 10.8}`} width={3} />
      <BigEye x={x} rx={4.4} ry={5.4} />
    </>
  );
}

const Nose = () => <path d="M57.7 71.2 h4.6 q0 2.6 -2.3 3 q-2.3 -0.4 -2.3 -3z" fill={DORI_PINK} />;

/** 코와 ω 입. 고양이다움은 여기서 나온다. 입 밑에 분홍 점(혀)은 두지 않는다(2026-11-02 피드백). */
const NoseMouth = () => (
  <>
    <Nose />
    <DoriStroke d="M60 74.2 q-0.9 3.4 -6.6 2.9 M60 74.2 q0.9 3.4 6.6 2.9" width={2.2} />
  </>
);

function DoriOpenMouth() {
  return (
    <>
      <Nose />
      <ellipse cx={60} cy={78.6} rx={4.6} ry={5} fill={DORI_EYE} />
      <ellipse cx={60} cy={81.4} rx={3} ry={2} fill={DORI_PINK} />
    </>
  );
}

function DoriGrinMouth() {
  return (
    <>
      <Nose />
      <path d="M53.6 75.6 Q60 86 66.4 75.6 Z" fill={DORI_EYE} stroke={DORI_EYE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M56.6 81.2 Q60 78.4 63.4 81.2 Q60 84.4 56.6 81.2 Z" fill={DORI_PINK} />
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
    <g transform="translate(0 5) rotate(10 60 33)">
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
function Flame({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
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

/** 표정마다 얼굴과 둘레 소품을 따로 둔다. 소품은 얼굴 위에 그린다(모자는 머리에 얹힌다). 눈은 왼쪽 42, 오른쪽 78이다. */
const LOOKS: Record<
  DoriMood,
  { face: ReactNode; props?: ReactNode }
> = {
  happy: {
    face: (
      <>
        <BigEye x={42} />
        <BigEye x={78} />
        <NoseMouth />
      </>
    ),
  },
  like: {
    face: (
      <>
        <DoriArcEye x={42} />
        <DoriArcEye x={78} />
        <NoseMouth />
      </>
    ),
    props: (
      <path
        d="M108 9 c-4.2 -7.4 -14.4 -3.2 -11.2 5.1 L108 25 l11.2 -10.9 c3.2 -8.3 -7 -12.5 -11.2 -5.1z"
        fill="#ff6f95"
      />
    ),
  },
  fire: {
    face: (
      <>
        <DoriSharpEye x={42} dir={-1} />
        <DoriSharpEye x={78} dir={1} />
        <DoriOpenMouth />
      </>
    ),
    // 귀에 닿지 않게 오른쪽 위 모서리에 세운다.
    props: <Flame x={108} y={46} scale={0.9} />,
  },
  clap: {
    face: (
      <>
        <DoriStarEye x={42} />
        <DoriStarEye x={78} />
        <DoriOpenMouth />
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
        <DoriArcEye x={42} />
        <DoriArcEye x={78} />
        <DoriOpenMouth />
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
        <DoriSleepyEye x={42} />
        <DoriSleepyEye x={78} />
        <NoseMouth />
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
        <DoriSadEye x={42} dir={-1} />
        <DoriSadEye x={78} dir={1} />
        <Nose />
        <DoriStroke d="M54.6 79.8 Q60 73.8 65.4 79.8" width={2.6} />
        <path d="M37.8 72.6 q-3 4.6 0 6.8 q3 -2.2 0 -6.8z" fill="#7cc8ff" />
      </>
    ),
  },
  confused: {
    face: (
      <>
        <BigEye x={42} />
        <ellipse cx={78} cy={EY - 0.5} rx={3.4} ry={4.2} fill={DORI_EYE} />
        <Nose />
        <DoriStroke d="M54 78 Q57 74 60 76.8 Q63 79.6 66 75.8" width={2.6} />
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
        <BigEye x={42} />
        <BigEye x={78} />
        <DoriOpenMouth />
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
        <DoriStroke d="M30 58.5 L90 58.5" width={3} />
        <path d="M30.5 57.5 H53.5 V65 Q53.5 73.5 42 73.5 Q30.5 73.5 30.5 65 Z" fill={DORI_EYE} />
        <path d="M66.5 57.5 H89.5 V65 Q89.5 73.5 78 73.5 Q66.5 73.5 66.5 65 Z" fill={DORI_EYE} />
        <Stroke d="M36 64 L40.4 60.6" width={2.2} color="#ffffff" />
        <Stroke d="M72 64 L76.4 60.6" width={2.2} color="#ffffff" />
        <Nose />
        <DoriStroke d="M54 77.4 Q60 81.6 66.4 76.4" width={2.6} />
      </>
    ),
  },
  wow: {
    face: (
      <>
        <BigEye x={42} rx={5.4} ry={6.4} />
        <BigEye x={78} rx={5.4} ry={6.4} />
        <Nose />
        <ellipse cx={60} cy={78.4} rx={3.4} ry={4.2} fill={DORI_EYE} />
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
        <path d={HEART} fill="#ff6f95" transform={`translate(42 ${EY}) scale(0.62) translate(-105 -18)`} />
        <path d={HEART} fill="#ff6f95" transform={`translate(78 ${EY}) scale(0.62) translate(-105 -18)`} />
        <DoriGrinMouth />
      </>
    ),
  },
};

/** 펭이의 머리와 얼굴. 둥근 머리 틀(HEAD)에 그린다. */
function PengHead({ mood }: { mood: CharacterMood }) {
  return (
    <>
      <Outlined>
        <g transform={HEAD} strokeWidth={OUTLINE / HEAD_SCALE}>
          {PENG_HEAD.shape}
        </g>
      </Outlined>

      <g transform={HEAD}>
        {PENG_HEAD.front}
        <CharacterFace character="peng" mood={mood} />
      </g>
    </>
  );
}

/** 몽이·하루: 도리와 같은 넓은 머리 틀(WIDE_FIT)에 각자의 머리를 얹고 같은 좌표계에서 얼굴을 그린다. */
function WideHead({ character, mood }: { character: "mong" | "haru"; mood: CharacterMood }) {
  return (
    <g transform={WIDE_FIT}>
      {character === "mong" ? <MongHead /> : <HaruHead />}
      <CharacterFace character={character} mood={mood} />
    </g>
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
      // 머리(귀·너구리 볼 털 포함)는 가로 12~108, 세로 20~100 안쪽이다. 아바타는 둘레를 넉넉히 준다.
      viewBox={avatar ? "-12 -10 144 144" : "0 0 120 120"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={PALETTES[character]}
    >
      {character === "dori" ? (
        <g transform={WIDE_FIT}>
          <DoriHead />
          {look.face}
        </g>
      ) : character === "peng" ? (
        <PengHead mood={mood} />
      ) : (
        <WideHead character={character} mood={mood} />
      )}

      {!avatar && isDoriMood && look.props}
      {!avatar && character !== "dori" && <CharacterProps mood={mood} />}
    </svg>
  );
}
