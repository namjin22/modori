// 도리를 뺀 캐릭터(몽이·하루·펭이)의 얼굴. 도리 표정을 그대로 옮기면 얼굴 구조가 다 같아 어색해서,
// 캐릭터마다 눈의 크기·간격·위치, 코, 입(또는 부리)을 따로 짠다. 귀엽게 보이는 비율을 먼저 잡았다:
// 눈은 크고 낮게(몽이·하루), 또는 작고 넓고 낮게(펭이), 하이라이트는 눈마다 두 개, 입은 코 바로 밑에 작게.
// 서버 컴포넌트에서도 쓰므로 상태나 훅을 두지 않는다. 좌표는 머리 좌표계(머리 중심 60,46)다.

import type { ReactNode } from "react";

import type { DoriMood } from "@/components/dori";
import type { CharacterId } from "@/lib/characters";

type Mouth = "smile" | "grin" | "open" | "shout" | "o" | "frown" | "wavy" | "smirk" | "small";
type EyeKind = "dot" | "arc" | "angry" | "star" | "sleepy" | "sad" | "wide" | "heart" | "shades" | "tiny";

/** 표정마다 눈·입 종류. 어느 캐릭터든 같은 뜻이고, 그리는 방식만 캐릭터마다 다르다. */
const SPEC: Record<Exclude<DoriMood, never>, { eye: EyeKind; eyeRight?: EyeKind; mouth: Mouth; tear?: boolean }> = {
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
};

type Layout = {
  left: number;
  right: number;
  y: number;
  rx: number;
  ry: number;
  tilt: number; // 바깥쪽 눈꼬리를 올리는 각도(여우)
  color: string;
  glint: number; // 하이라이트 크기 배율
  single?: boolean; // 하이라이트 하나만(펭귄, 새 눈처럼 자연스럽게)
  lidFill?: string; // 눈썹 없이 화난·슬픈 눈을 만드는 눈꺼풀 색(얼굴 바탕색)
};

const LAYOUT: Record<Exclude<CharacterId, "dori">, Layout> = {
  mong: { left: 43, right: 77, y: 47.5, rx: 6.6, ry: 7.8, tilt: 0, color: "#4b392f", glint: 1.1 },
  haru: { left: 42, right: 78, y: 48, rx: 6.8, ry: 6.4, tilt: 6, color: "#5a2f1c", glint: 1, lidFill: "var(--ch-body)" },
  peng: { left: 43, right: 77, y: 50.5, rx: 5.2, ry: 6.2, tilt: 0, color: "#1e2a47", glint: 1, single: true, lidFill: "#fffaf2" },
};

const PINK = "#ff8fa5";

function Stroke({ d, w = 2.8, color }: { d: string; w?: number; color: string }) {
  return <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

function Eye({ kind, x, dir, l, noBrow = false }: { kind: EyeKind; x: number; dir: 1 | -1; l: Layout; noBrow?: boolean }) {
  const { y, rx, ry, color, glint, tilt, single, lidFill } = l;
  // squash: 세로를 줄인다(화난 눈). turn: 안쪽 끝을 내리면(+) 화난 눈, 올리면(-) 슬픈 눈. 눈썹을 못 그리는 캐릭터(펭귄)가 눈 모양으로 표정을 낸다.
  const dot = (scale = 1, turn = 0, squash = 1) => (
    <g transform={`rotate(${-dir * (tilt + turn)} ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={rx * scale} ry={ry * scale * squash} fill={color} />
      <circle cx={x + rx * 0.34 * scale} cy={y - ry * 0.34 * scale} r={rx * (single ? 0.36 : 0.44) * glint * scale} fill="#fff" />
      {!single && <circle cx={x - rx * 0.42 * scale} cy={y + ry * 0.4 * scale} r={rx * 0.2 * glint * scale} fill="#fff" />}
    </g>
  );
  const brow = (outerY: number, innerY: number) => (
    <Stroke d={`M${x + 8.5 * dir} ${y + outerY} L${x - 6.5 * dir} ${y + innerY}`} w={3.2} color={color} />
  );
  switch (kind) {
    case "dot":
      return dot();
    case "tiny":
      return dot(0.72);
    case "wide":
      return dot(1.2);
    case "arc":
      return <Stroke d={`M${x - 6.8} ${y + 2.8} Q${x} ${y - 7.5} ${x + 6.8} ${y + 2.8}`} w={3.8} color={color} />;
    case "sleepy":
      return <Stroke d={`M${x - 6.5} ${y - 1.5} Q${x} ${y + 6} ${x + 6.5} ${y - 1.5}`} w={3.6} color={color} />;
    case "angry":
      if (!noBrow) return <>{dot(0.92)}{brow(-10, -5.5)}</>;
      // 눈꺼풀이 바깥에서 안쪽으로 내려와 화난 눈이 된다(눈썹 없이).
      return (
        <>
          {dot()}
          <path d={`M${x + dir * 8.8} ${y - 10} L${x - dir * 8.8} ${y - 10} L${x - dir * 8.8} ${y - 0.5} L${x + dir * 8.8} ${y - 6}Z`} fill={lidFill} />
        </>
      );
    case "sad":
      if (!noBrow) return <>{dot()}{brow(-6.5, -11)}</>;
      // 눈꺼풀이 안쪽에서 바깥으로 처져 눈꼬리가 내려간 슬픈 눈이 된다.
      return (
        <>
          {dot()}
          <path d={`M${x - dir * 8.8} ${y - 10} L${x + dir * 8.8} ${y - 10} L${x + dir * 8.8} ${y + 0.5} L${x - dir * 8.8} ${y - 6.5}Z`} fill={lidFill} />
        </>
      );
    case "star":
      return (
        <path
          d={`M${x} ${y - 8.5} l2.8 5.7 6.2 .8 -4.6 4.3 1.2 6.1 -5.6 -3.2 -5.6 3.2 1.2 -6.1 -4.6 -4.3 6.2 -.8z`}
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
          fill="#ff6f95"
        />
      );
    case "shades":
      return (
        <g>
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

function DogFace({ mood }: { mood: DoriMood }) {
  const l = LAYOUT.mong;
  const s = SPEC[mood];
  return (
    <>
      {/* 눈썹 점: 강아지 얼굴의 귀여움 포인트. 표정에 따라 같이 오르내린다. */}
      <g fill="#c98f5f">
        <ellipse cx={l.left} cy={l.y - 11.5} rx={2.9} ry={2} />
        <ellipse cx={l.right} cy={l.y - 11.5} rx={2.9} ry={2} />
      </g>
      <Eye kind={s.eye} x={l.left} dir={-1} l={l} />
      <Eye kind={s.eyeRight ?? s.eye} x={l.right} dir={1} l={l} />
      {s.tear && <path d={`M${l.left - 3} ${l.y + 9} q-3 4.2 0 6.6 q3 -2.4 0 -6.6z`} fill="#8ecbff" />}
      <ellipse cx={60} cy={54.2} rx={5.2} ry={3.7} fill="#4b392f" />
      <ellipse cx={58.3} cy={52.9} rx={1.7} ry={1} fill="#fff" opacity={0.8} />
      <OmegaMouth kind={s.mouth} top={57.7} w={8.6} depth={4.4} color="#4b392f" tongue={3.4} />
    </>
  );
}

function FoxFace({ mood }: { mood: DoriMood }) {
  const l = LAYOUT.haru;
  const s = SPEC[mood];
  return (
    <>
      <Eye kind={s.eye} x={l.left} dir={-1} l={l} noBrow />
      <Eye kind={s.eyeRight ?? s.eye} x={l.right} dir={1} l={l} noBrow />
      {s.tear && <path d={`M${l.left - 3} ${l.y + 9.5} q-3 4.2 0 6.6 q3 -2.4 0 -6.6z`} fill="#8ecbff" />}
      <path d="M55.4 53.4 Q60 50.4 64.6 53.4 Q62.4 57.4 60 57.8 Q57.6 57.4 55.4 53.4Z" fill="#3d2b25" />
      <ellipse cx={58.4} cy={52.8} rx={1.4} ry={0.8} fill="#fff" opacity={0.75} />
      <OmegaMouth kind={s.mouth} top={58} w={7.4} depth={4} color="#4a2d28" tongue={2.8} />
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

function PenguinFace({ mood }: { mood: DoriMood }) {
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
    </>
  );
}

/** 도리를 뺀 캐릭터의 얼굴(눈·코·입). 머리 좌표계 안에서 그린다. */
export function CharacterFace({ character, mood }: { character: Exclude<CharacterId, "dori">; mood: DoriMood }): ReactNode {
  if (character === "mong") return <DogFace mood={mood} />;
  if (character === "haru") return <FoxFace mood={mood} />;
  return <PenguinFace mood={mood} />;
}
