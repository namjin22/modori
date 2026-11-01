// 도리를 뺀 캐릭터(몽이·하루·펭이)의 얼굴. 도리 표정을 그대로 옮기면 얼굴 구조가 다 같아 어색해서,
// 캐릭터마다 눈의 크기·간격·위치, 코, 입(또는 부리)을 따로 짠다.
// 몽이·하루는 2026-11-02 참고 그림(작은 점 눈, 하이라이트 없음, 코에서 갈라지는 ω 입)을 따라 작고 낮은 눈으로 다시 짰다.
// 펭이는 그대로 작고 넓고 낮은 눈에 하이라이트 하나다.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다.
// 좌표계: 펭이는 둥근 머리 틀(머리 중심 60,46), 몽이·하루는 도리와 같은 머리 가운데(60,62~66)에서 그린다(components/character-heads.tsx).

import type { ReactNode } from "react";

import { MASK } from "@/components/character-heads";
import type { CharacterId, CharacterMood } from "@/lib/characters";

type Mouth = "smile" | "grin" | "open" | "shout" | "o" | "frown" | "wavy" | "smirk" | "small" | "tongue" | "none";
type EyeKind = "dot" | "arc" | "angry" | "star" | "sleepy" | "sad" | "wide" | "heart" | "shades" | "tiny" | "wink" | "beg" | "half" | "side";

/** 표정마다 눈·입 종류. 어느 캐릭터든 같은 뜻이고, 그리는 방식만 캐릭터마다 다르다. */
const SPEC: Record<CharacterMood, { eye: EyeKind; eyeRight?: EyeKind; mouth: Mouth; tear?: boolean }> = {
  happy: { eye: "dot", mouth: "smile" },
  like: { eye: "arc", mouth: "smile" },
  fire: { eye: "angry", mouth: "shout" },
  clap: { eye: "star", eyeRight: "star", mouth: "open" },
  party: { eye: "arc", mouth: "grin" },
  calm: { eye: "sleepy", mouth: "small" },
  sad: { eye: "sad", mouth: "frown", tear: true },
  confused: { eye: "dot", eyeRight: "tiny", mouth: "wavy" },
  hello: { eye: "dot", mouth: "open" },
  cool: { eye: "shades", mouth: "smirk" },
  wow: { eye: "wide", mouth: "o" },
  love: { eye: "heart", mouth: "grin" },
  // 개성 표정. 얼굴 밖 소품은 CharacterProps, 얼굴 위 소품(뼈다귀·물고기·목도리·물안경)은 각 얼굴이 그린다.
  pant: { eye: "arc", mouth: "tongue" },
  bone: { eye: "arc", mouth: "none" },
  beg: { eye: "beg", mouth: "small" },
  ball: { eye: "dot", mouth: "grin" },
  wink: { eye: "dot", eyeRight: "wink", mouth: "smile" },
  shy: { eye: "side", mouth: "small" },
  foxfire: { eye: "arc", mouth: "grin" },
  smug: { eye: "half", mouth: "smirk" },
  fish: { eye: "arc", mouth: "small" },
  snowman: { eye: "arc", mouth: "small" },
  nap: { eye: "sleepy", mouth: "none" },
  goggles: { eye: "dot", mouth: "small" },
};

type Layout = {
  left: number;
  right: number;
  y: number;
  rx: number;
  ry: number;
  tilt: number; // 바깥쪽 눈꼬리를 올리는 각도
  color: string;
  glint: number; // 하이라이트 크기 배율. 0이면 하이라이트 없는 민짜 점 눈
  single?: boolean; // 하이라이트 하나만(펭귄, 새 눈처럼 자연스럽게)
  lidFill?: string; // 눈썹 없이 화난·슬픈 눈을 만드는 눈꺼풀 색(얼굴 바탕색)
  s: number; // 감은 눈·별·하트·선글라스 같은 선 눈의 크기 배율(점 눈은 rx·ry를 따른다)
  line?: string; // 선 눈의 색. 없으면 color. 너구리는 검은 띠 위라 밝은 크림색을 쓴다
};

const DOG_INK = "#3d1f14";
const RACCOON_INK = "#26232b";

const LAYOUT: Record<Exclude<CharacterId, "dori">, Layout> = {
  mong: { left: 45, right: 75, y: 66, rx: 3.7, ry: 4.9, tilt: 0, color: DOG_INK, glint: 0, s: 0.78 },
  haru: { left: 45, right: 75, y: 70, rx: 3.9, ry: 5.3, tilt: 0, color: RACCOON_INK, glint: 0, s: 0.8, line: "#fbf1de", lidFill: MASK },
  peng: { left: 43, right: 77, y: 50.5, rx: 5.2, ry: 6.2, tilt: 0, color: "#1e2a47", glint: 1, s: 1, single: true, lidFill: "#fffaf2" },
};

const PINK = "#ff8fa5";

function Stroke({ d, w = 2.8, color }: { d: string; w?: number; color: string }) {
  return <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

function Eye({ kind, x, dir, l, noBrow = false }: { kind: EyeKind; x: number; dir: 1 | -1; l: Layout; noBrow?: boolean }) {
  const { y, rx, ry, color, glint, tilt, single, lidFill, s } = l;
  const line = l.line ?? color;
  // squash: 세로를 줄인다(화난 눈). turn: 안쪽 끝을 내리면(+) 화난 눈, 올리면(-) 슬픈 눈. 눈썹을 못 그리는 캐릭터(펭귄)가 눈 모양으로 표정을 낸다.
  const dot = (scale = 1, turn = 0, squash = 1, shine = glint > 0) => (
    <g transform={`rotate(${-dir * (tilt + turn)} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={rx * scale} ry={ry * scale * squash} fill={color} />
      {shine && <circle cx={x + rx * 0.34 * scale} cy={y - ry * 0.34 * scale} r={rx * (single ? 0.36 : 0.44) * Math.max(glint, 1) * scale} fill="#fff" />}
      {shine && !single && <circle cx={x - rx * 0.42 * scale} cy={y + ry * 0.4 * scale} r={rx * 0.2 * Math.max(glint, 1) * scale} fill="#fff" />}
    </g>
  );
  const brow = (outerY: number, innerY: number) => (
    <Stroke d={`M${x + 8.5 * dir * s} ${y + outerY * s} L${x - 6.5 * dir * s} ${y + innerY * s}`} w={3} color={line} />
  );
  // 별·하트는 원래 크기(반지름 9쯤)로 적어 두고 눈 크기에 맞춰 눈 가운데를 기준으로 줄인다.
  const fit = `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;
  switch (kind) {
    case "side":
      // 부끄러워 눈을 옆으로 피한다.
      return <g transform="translate(1.4 1.4)">{dot(0.92)}</g>;
    case "wink":
      // 안쪽을 가리키는 꺾쇠(>·<)로 감은 눈.
      return <Stroke d={`M${x + dir * 6 * s} ${y - 5 * s} L${x - dir * 5 * s} ${y} L${x + dir * 6 * s} ${y + 5 * s}`} w={3.2} color={line} />;
    case "beg":
      // 커다랗고 촉촉한 눈: 하이라이트를 둘 더하고 아래에 맺힌 눈물 선. 평소엔 하이라이트가 없어서 이 표정만 반짝인다.
      return (
        <>
          {dot(1.25, 0, 1, false)}
          <circle cx={x + rx * 0.4} cy={y - ry * 0.42} r={rx * 0.5} fill="#fff" />
          <circle cx={x - rx * 0.45} cy={y + ry * 0.45} r={rx * 0.24} fill="#fff" opacity={0.9} />
          <path d={`M${x - rx * 1.5} ${y + ry * 1.45} Q${x} ${y + ry * 2.1} ${x + rx * 1.5} ${y + ry * 1.45}`} stroke="#8ecbff" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </>
      );
    case "half":
      // 반쯤 감은 흐뭇한 눈: 위쪽을 얼굴색 눈꺼풀이 덮는다.
      return (
        <>
          {dot()}
          <path d={`M${x - 9 * s} ${y - 11 * s} L${x + 9 * s} ${y - 11 * s} L${x + 9 * s} ${y - 0.6 * s} Q${x} ${y + 1.4 * s} ${x - 9 * s} ${y - 0.6 * s}Z`} fill={lidFill ?? "#fff"} />
          <Stroke d={`M${x - 7.2 * s} ${y - 0.4 * s} Q${x} ${y + 1.6 * s} ${x + 7.2 * s} ${y - 0.4 * s}`} w={2.4} color={line} />
        </>
      );
    case "dot":
      return dot();
    case "tiny":
      return dot(0.72);
    case "wide":
      return dot(1.2);
    case "arc":
      return <Stroke d={`M${x - 6.8 * s} ${y + 2.8 * s} Q${x} ${y - 7.5 * s} ${x + 6.8 * s} ${y + 2.8 * s}`} w={3.4} color={line} />;
    case "sleepy":
      return <Stroke d={`M${x - 6.5 * s} ${y - 1.5 * s} Q${x} ${y + 6 * s} ${x + 6.5 * s} ${y - 1.5 * s}`} w={3.2} color={line} />;
    case "angry":
      if (!noBrow) return <>{dot(0.92)}{brow(-10, -5.5)}</>;
      // 눈꺼풀이 바깥에서 안쪽으로 내려와 화난 눈이 된다(눈썹 없이).
      return (
        <>
          {dot()}
          <path d={`M${x + dir * 8.8 * s} ${y - 10 * s} L${x - dir * 8.8 * s} ${y - 10 * s} L${x - dir * 8.8 * s} ${y - 0.5 * s} L${x + dir * 8.8 * s} ${y - 6 * s}Z`} fill={lidFill} />
        </>
      );
    case "sad":
      if (!noBrow) return <>{dot()}{brow(-6.5, -11)}</>;
      // 눈꺼풀이 안쪽에서 바깥으로 처져 눈꼬리가 내려간 슬픈 눈이 된다.
      return (
        <>
          {dot()}
          <path d={`M${x - dir * 8.8 * s} ${y - 10 * s} L${x + dir * 8.8 * s} ${y - 10 * s} L${x + dir * 8.8 * s} ${y + 0.5 * s} L${x - dir * 8.8 * s} ${y - 6.5 * s}Z`} fill={lidFill} />
        </>
      );
    case "star":
      return (
        <path
          d={`M${x} ${y - 8.5} l2.8 5.7 6.2 .8 -4.6 4.3 1.2 6.1 -5.6 -3.2 -5.6 3.2 1.2 -6.1 -4.6 -4.3 6.2 -.8z`}
          transform={fit}
          fill="#ffb13d"
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      );
    case "heart":
      return (
        <path
          d={`M${x} ${y + 6.5} C${x - 10} ${y - 1} ${x - 4.5} ${y - 8.5} ${x} ${y - 3.2} C${x + 4.5} ${y - 8.5} ${x + 10} ${y - 1} ${x} ${y + 6.5}z`}
          transform={fit}
          fill="#ff6f95"
        />
      );
    case "shades":
      return (
        <g transform={fit}>
          <rect x={x - 9} y={y - 6.5} width={18} height={12.5} rx={5} fill="#2d3550" />
          <path d={`M${x - 5.5} ${y - 3.5} l4 -.1`} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
        </g>
      );
  }
}

/** 코 밑에서 갈라지는 "ω" 입(몽이·하루). top은 코 밑 y, w는 한쪽 폭, depth는 입꼬리 깊이. */
function OmegaMouth({ kind, top, w, depth, color, tongue }: { kind: Mouth; top: number; w: number; depth: number; color: string; tongue: number }) {
  const t = top + 2.6; // 입이 갈라지는 점
  const base = `M60 ${top} L60 ${t}`;
  const smile = `${base} M60 ${t} Q${60 - w * 0.55} ${t + depth} ${60 - w} ${t + 0.8} M60 ${t} Q${60 + w * 0.55} ${t + depth} ${60 + w} ${t + 0.8}`;
  switch (kind) {
    case "none":
      return null;
    case "tongue":
      // 헥헥: 벌린 입 아래로 혀가 길게 나온다.
      return (
        <>
          <path
            d={`M${60 - w} ${t} Q60 ${t + 2} ${60 + w} ${t} Q${60 + w * 0.8} ${t + depth * 2.3} 60 ${t + depth * 2.3} Q${60 - w * 0.8} ${t + depth * 2.3} ${60 - w} ${t}Z`}
            fill="#5a2f3b"
          />
          <path d={`M${60 - w * 0.55} ${t + depth * 1.3} Q${60 - w * 0.6} ${t + depth * 3.6} 60 ${t + depth * 3.6} Q${60 + w * 0.6} ${t + depth * 3.6} ${60 + w * 0.55} ${t + depth * 1.3}Z`} fill={PINK} />
          <Stroke d={`M60 ${t + depth * 1.6} L60 ${t + depth * 2.9}`} w={1.4} color="#e0607a" />
          <Stroke d={base} color={color} />
        </>
      );
    case "smile":
      return (
        <>
          <ellipse cx={60} cy={t + depth - 0.5} rx={tongue} ry={tongue * 1.2} fill={PINK} />
          <Stroke d={smile} color={color} />
        </>
      );
    case "small":
      return <Stroke d={smile} color={color} />;
    case "grin":
    case "open":
    case "shout":
      return (
        <>
          <path
            d={`M${60 - w} ${t} Q60 ${t + 2} ${60 + w} ${t} Q${60 + w * 0.8} ${t + depth * 2.7} 60 ${t + depth * 2.7} Q${60 - w * 0.8} ${t + depth * 2.7} ${60 - w} ${t}Z`}
            fill="#5a2f3b"
            stroke="#5a2f3b"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <ellipse cx={60} cy={t + depth * 2.2} rx={w * 0.52} ry={depth * 0.7} fill={PINK} />
          <Stroke d={base} color={color} />
        </>
      );
    case "o":
      return (
        <>
          <ellipse cx={60} cy={t + depth * 0.9} rx={w * 0.38} ry={depth * 0.95} fill="#5a2f3b" />
          <Stroke d={base} color={color} />
        </>
      );
    case "frown":
      return <Stroke d={`${base} M60 ${t} Q${60 - w * 0.55} ${t - depth * 0.7} ${60 - w} ${t + depth * 0.6} M60 ${t} Q${60 + w * 0.55} ${t - depth * 0.7} ${60 + w} ${t + depth * 0.6}`} color={color} />;
    case "wavy":
      return <Stroke d={`${base} M${60 - w} ${t + depth * 0.8} q${w * 0.5} ${-depth} ${w} 0 t${w} 0`} color={color} />;
    case "smirk":
      return <Stroke d={`${base} M60 ${t} Q${60 - w * 0.5} ${t + depth} ${60 - w} ${t + 0.8} M60 ${t} Q${60 + w * 0.6} ${t + depth * 0.9} ${60 + w} ${t - depth * 0.7}`} color={color} />;
  }
}

/** 몽이가 입에 문 뼈다귀. */
function Bone() {
  return (
    <g transform="translate(60 85) rotate(-8)">
      <g fill="#fffaf2" stroke="#c9a37f" strokeWidth={1.6}>
        <circle cx={-14} cy={-3.2} r={3.8} />
        <circle cx={-14} cy={3.2} r={3.8} />
        <circle cx={14} cy={-3.2} r={3.8} />
        <circle cx={14} cy={3.2} r={3.8} />
        <rect x={-14} y={-3.2} width={28} height={6.4} rx={3} />
      </g>
      <rect x={-12.6} y={-2.3} width={25.2} height={4.6} fill="#fffaf2" />
    </g>
  );
}

function DogFace({ mood }: { mood: CharacterMood }) {
  const l = LAYOUT.mong;
  const s = SPEC[mood];
  return (
    <>
      <Eye kind={s.eye} x={l.left} dir={-1} l={l} />
      <Eye kind={s.eyeRight ?? s.eye} x={l.right} dir={1} l={l} />
      {s.tear && <path d={`M${l.left - 2.4} ${l.y + l.ry + 1.4} q-2.6 4 0 6 q2.6 -2 0 -6z`} fill="#8ecbff" />}
      <ellipse cx={60} cy={71.6} rx={5.2} ry={3.7} fill={DOG_INK} />
      <OmegaMouth kind={s.mouth} top={75} w={7.2} depth={3.8} color={DOG_INK} tongue={2.4} />
      {mood === "bone" && <Bone />}
    </>
  );
}

/** 하루(너구리): 검은 띠 위의 작은 점 눈, 띠 사이 크림색 주둥이에 검은 코, 넓게 웃는 입. */
function RaccoonFace({ mood }: { mood: CharacterMood }) {
  const l = LAYOUT.haru;
  const s = SPEC[mood];
  return (
    <>
      <Eye kind={s.eye} x={l.left} dir={-1} l={l} noBrow />
      <Eye kind={s.eyeRight ?? s.eye} x={l.right} dir={1} l={l} noBrow />
      {s.tear && <path d={`M${l.left - 2.4} ${l.y + l.ry + 1.4} q-2.6 4 0 6 q2.6 -2 0 -6z`} fill="#8ecbff" />}
      {mood === "shy" && (
        <g>
          <ellipse cx={29} cy={87} rx={8} ry={4.4} fill="#ff6f6f" opacity={0.45} />
          <ellipse cx={91} cy={87} rx={8} ry={4.4} fill="#ff6f6f" opacity={0.45} />
          <path d="M23 85 l2.6 3.4 M27.6 84.6 l2.6 3.4 M32.2 85 l2.6 3.4 M85.2 85 l2.6 3.4 M89.8 84.6 l2.6 3.4 M94.4 85 l2.6 3.4" stroke="#ff4d4d" strokeWidth={1.3} strokeLinecap="round" opacity={0.65} />
        </g>
      )}
      <path d="M55.4 72.6 Q60 70 64.6 72.6 Q63.2 77.2 60 77.6 Q56.8 77.2 55.4 72.6Z" fill={RACCOON_INK} />
      <OmegaMouth kind={s.mouth} top={77.4} w={7.8} depth={3.6} color={RACCOON_INK} tongue={2.4} />
    </>
  );
}

/**
 * 펭귄은 입이 따로 없고 부리만 있다. 표정은 부리 모양으로: 닫힌 부리, 살짝 열린 부리(위아래가 갈라짐), 기울인 부리.
 * 눈썹도 없어서 눈 모양(기울기·크기)으로 표정을 낸다. 눈은 작게 넓고 낮게 둬서 아기처럼 보이게 한다.
 */
function Beak({ kind }: { kind: Mouth }) {
  const orange = "var(--ch-ear, #ffb13d)";
  const edge = "#e68a1f";
  const upper = "M52.8 54.6 Q60 49.8 67.2 54.6 Q65.2 59.8 60 60.4 Q54.8 59.8 52.8 54.6Z";
  const closed = (rot = 0, dy = 0) => (
    <g transform={`translate(0 ${dy}) rotate(${rot} 60 57)`}>
      <path d="M52.5 54.6 Q60 49.8 67.5 54.6 Q65.5 62.4 60 63 Q54.5 62.4 52.5 54.6Z" fill={orange} stroke={edge} strokeWidth={1.3} strokeLinejoin="round" />
      <ellipse cx={57.6} cy={53.6} rx={2.2} ry={1} fill="#fff" opacity={0.55} />
    </g>
  );
  switch (kind) {
    case "open":
    case "grin":
    case "shout":
    case "o":
      return (
        <>
          <path d="M54.4 60.6 Q60 59.6 65.6 60.6 Q64 65.6 60 66 Q56 65.6 54.4 60.6Z" fill="#f59e2b" stroke={edge} strokeWidth={1.2} strokeLinejoin="round" />
          <path d={upper} fill={orange} stroke={edge} strokeWidth={1.3} strokeLinejoin="round" />
          <ellipse cx={57.6} cy={53.6} rx={2.2} ry={1} fill="#fff" opacity={0.55} />
        </>
      );
    case "frown":
      return closed(0, 2.4);
    case "wavy":
      return closed(-9);
    case "smirk":
      return closed(8);
    default:
      return closed();
  }
}

/** 펭이가 부리에 문 물고기. */
function Fish() {
  return (
    <g transform="translate(70 61) rotate(-12)">
      <path d="M-8 0 Q0 -6.5 9 0 Q0 6.5 -8 0Z" fill="#8fc4e8" stroke="#5b8fb8" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M8 0 L14.5 -5 L13.5 0 L14.5 5Z" fill="#8fc4e8" stroke="#5b8fb8" strokeWidth={1.2} strokeLinejoin="round" />
      <circle cx={-4} cy={-1.2} r={1.2} fill="#1e2a47" />
    </g>
  );
}

/** 펭이 물안경: 눈 위에 둥근 렌즈 둘과 끈. */
function Goggles({ l }: { l: Layout }) {
  return (
    <g>
      <path d={`M24 ${l.y - 2} L${l.left - 9} ${l.y} M${l.left + 9} ${l.y} L${l.right - 9} ${l.y} M${l.right + 9} ${l.y} L96 ${l.y - 2}`} stroke="#2563eb" strokeWidth={3} strokeLinecap="round" />
      {[l.left, l.right].map((x) => (
        <g key={x}>
          <circle cx={x} cy={l.y} r={9} fill="#bfe3ff" opacity={0.45} />
          <circle cx={x} cy={l.y} r={9} fill="none" stroke="#2563eb" strokeWidth={2.8} />
          <path d={`M${x - 4.5} ${l.y - 4} q2 -2 4.5 -2.2`} stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

function PenguinFace({ mood }: { mood: CharacterMood }) {
  const l = LAYOUT.peng;
  const s = SPEC[mood];
  return (
    <>
      <Eye kind={s.eye} x={l.left} dir={-1} l={l} noBrow />
      <Eye kind={s.eyeRight ?? s.eye} x={l.right} dir={1} l={l} noBrow />
      {s.tear && (
        <>
          <path d={`M${l.left - 2} ${l.y + 7.5} q-4 5.4 0 8.6 q4 -3.2 0 -8.6z`} fill="#8ecbff" />
          <path d={`M${l.right + 2} ${l.y + 7.5} q-4 5.4 0 8.6 q4 -3.2 0 -8.6z`} fill="#8ecbff" />
        </>
      )}
      <Beak kind={s.mouth} />
      {mood === "fish" && <Fish />}
      {mood === "goggles" && <Goggles l={l} />}
    </>
  );
}

/** 도리를 뺀 캐릭터의 얼굴(눈·코·입). 머리 좌표계 안에서 그린다. */
export function CharacterFace({ character, mood }: { character: Exclude<CharacterId, "dori">; mood: CharacterMood }): ReactNode {
  if (character === "mong") return <DogFace mood={mood} />;
  if (character === "haru") return <RaccoonFace mood={mood} />;
  return <PenguinFace mood={mood} />;
}

const SPARK = "#ffd34d";
const sparkle = (x: number, y: number, r: number, color = SPARK) => (
  <path
    key={`${x}-${y}`}
    d={`M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r}Z`}
    fill={color}
  />
);

/** 개성 표정의 얼굴 밖 소품(120×120 좌표). 공통 표정 소품은 도리 것(하트·고깔 모자 등)을 같이 쓴다. */
export function CharacterProps({ mood }: { mood: CharacterMood }): ReactNode {
  switch (mood) {
    case "pant":
      // 신나서 흔들리는 선.
      return (
        <g stroke="#a8b6d1" strokeWidth={3} fill="none" strokeLinecap="round">
          <path d="M10 56 q-5 8 0 16" />
          <path d="M4 52 q-6 12 0 24" />
          <path d="M110 56 q5 8 0 16" />
          <path d="M116 52 q6 12 0 24" />
        </g>
      );
    case "beg":
      return <>{[sparkle(16, 40, 6), sparkle(104, 34, 7), sparkle(108, 54, 4)]}</>;
    case "ball":
      // 옆으로 통통 튀는 테니스공.
      return (
        <g>
          <path d="M98 104 q4 -6 8 0 M92 108 q3 -4 6 0" stroke="#a8b6d1" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <circle cx={104} cy={84} r={10} fill="#c6e85b" stroke="#8fb33a" strokeWidth={1.6} />
          <path d="M95.5 79 Q104 84 95.8 90 M112.5 78 Q104 84 112.2 90" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      );
    case "wink":
      return <>{[sparkle(102, 34, 7), sparkle(110, 48, 4)]}</>;
    case "shy":
      // 수줍: 식은땀 한 방울과 작은 하트.
      return (
        <g>
          <path d="M100 36 q-5 7 0 11 q5 -4 0 -11z" fill="#8ecbff" />
          <path d="M16 36 c-3 -5 -9 -2 -6 3 l6 6 l6 -6 c3 -5 -3 -8 -6 -3z" fill="#ff8fa5" transform="scale(0.8) translate(6 10)" />
        </g>
      );
    case "foxfire": {
      // 너구리가 머리에 나뭇잎을 얹고 변신하는 이야기에서 왔다. 저장된 반응 값("haru:foxfire")이 있어 이름은 그대로 둔다.
      return (
        <g>
          <g transform="rotate(-14 60 44)">
            <path d="M60 45 C49 43 46 31 58 24 C71 28 72 40 60 45Z" fill="#7ccf6e" stroke="#4f9a4a" strokeWidth={1.6} strokeLinejoin="round" />
            <path d="M60 44 L59 31" stroke="#4f9a4a" strokeWidth={1.4} strokeLinecap="round" />
          </g>
          {sparkle(15, 40, 6)}
          {sparkle(105, 34, 7)}
          {sparkle(108, 54, 4)}
        </g>
      );
    }
    case "smug":
      return <>{[sparkle(104, 40, 5, "#ffb8c6")]}</>;
    case "snowman":
      // 눈사람 친구: 눈덩이 둘, 당근 코, 나뭇가지 팔. 위로는 눈송이가 떨어진다.
      return (
        <g>
          <path d="M91 92 L82 86 M109 92 L118 86" stroke="#8a6a4a" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={100} cy={97} r={12} fill="#fff" stroke="#c9d6ea" strokeWidth={1.6} />
          <circle cx={100} cy={77} r={9} fill="#fff" stroke="#c9d6ea" strokeWidth={1.6} />
          <circle cx={97} cy={75} r={1.3} fill="#1e2a47" />
          <circle cx={103} cy={75} r={1.3} fill="#1e2a47" />
          <path d="M100 77.5 L106.5 79 L100 80.5Z" fill="#ff8a3d" />
          <circle cx={100} cy={96} r={1.2} fill="#1e2a47" />
          <circle cx={100} cy={101} r={1.2} fill="#1e2a47" />
          {sparkle(18, 40, 5, "#cfe0ff")}
          {sparkle(108, 54, 4, "#cfe0ff")}
          {sparkle(26, 26, 3.4, "#cfe0ff")}
        </g>
      );
    case "nap":
      // 낮잠: 빨간 나이트캡(방울이 늘어짐)과 Zzz.
      return (
        <g>
          <path d="M36 42 Q38 20 64 22 Q96 24 106 56 Q84 40 36 42Z" fill="#ef4444" stroke="#c53030" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M33 43 Q62 52 90 43 L90 37 Q62 46 33 37Z" fill="#fffaf2" stroke="#e5e7eb" strokeWidth={1} strokeLinejoin="round" />
          <circle cx={106} cy={58} r={5.4} fill="#fffaf2" stroke="#e5e7eb" strokeWidth={1} />
          <text x={92} y={22} fontSize={13} fontWeight={800} fill="#a8b6d1" fontFamily="sans-serif">z</text>
          <text x={102} y={12} fontSize={10} fontWeight={800} fill="#a8b6d1" fontFamily="sans-serif">z</text>
        </g>
      );
    case "goggles":
      return (
        <g fill="none" stroke="#8ecbff" strokeWidth={2}>
          <circle cx={104} cy={40} r={4} />
          <circle cx={110} cy={28} r={2.6} />
          <circle cx={100} cy={22} r={1.8} />
        </g>
      );
    default:
      return null;
  }
}
