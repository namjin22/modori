import type { ReactNode } from "react";

import type { DiaryMoodKey } from "@/lib/diary";

/**
 * 일기의 "오늘의 기분" 그림(2026-11-18 요청: 반응에서 쓰는 도리 표정은 어색하고 조잡하다). 반응용 캐릭터와 겹치지 않게 일기 전용으로
 * 직접 그린 "마음 날씨" 여섯 가지다. 해·구름 조금·흐림·비·천둥·밤이 기분 좋음에서 나쁨까지 이어지고, 표정은 모두 다르게 그려 멍하니 서 있는 얼굴이 없다.
 * 색은 면 두세 가지만 쓰고 테두리는 두지 않는다. 얼굴 선은 라이트·다크 어디서나 보이는 짙은 갈색이다. 서버·브라우저 화면이 같이 쓰므로 훅을 두지 않는다.
 */

/** 기분마다 한 가지 대표색. 고르는 칸·카드·목록 그림의 바탕 물들이기와 선택 테두리에 쓴다. */
export const MOOD_COLORS: Record<DiaryMoodKey, string> = {
  sun: "#ffbe1a",
  partly: "#5aa9ff",
  cloud: "#8f9fbd",
  rain: "#4f86ee",
  storm: "#8466d9",
  moon: "#7b6be0",
};

const INK = "#3b2a26";
const CHEEK = "#ff8f9c";

const stroke = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** 구름 몸통. cx·cy는 가운데 아래쪽이고 크기는 scale로 정한다. 아래에 한 겹 더 진한 면을 깔아 입체감을 준다. */
function Cloud({ fill, shade, x = 0, y = 0 }: { fill: string; shade: string; x?: number; y?: number }) {
  const body = (color: string, dy: number): ReactNode => (
    <g fill={color} transform={`translate(${x} ${y + dy})`}>
      <circle cx={21} cy={37} r={10} />
      <circle cx={33} cy={30} r={13} />
      <circle cx={45} cy={37} r={10} />
      <rect x={21} y={37} width={24} height={10} rx={5} />
    </g>
  );
  return (
    <>
      {body(shade, 2.4)}
      {body(fill, 0)}
    </>
  );
}

const ICONS: Record<DiaryMoodKey, ReactNode> = {
  // 맑음: 활짝 웃는 해. 눈을 감고 웃고 볼이 발갛다.
  sun: (
    <>
      <g stroke="#ffa800" strokeWidth={3.6} strokeLinecap="round">
        {Array.from({ length: 8 }, (_, index) => {
          const angle = (index * Math.PI) / 4;
          const point = (radius: number) => `${(32 + radius * Math.cos(angle)).toFixed(2)} ${(32 + radius * Math.sin(angle)).toFixed(2)}`;
          return <path key={index} d={`M${point(21.5)} L${point(27.5)}`} />;
        })}
      </g>
      <circle cx={32} cy={32} r={17} fill="#ffcb3d" />
      <path d="M15.6 33 a16.4 16.4 0 0 0 32.8 0 Z" fill="#ffb81f" opacity={0.35} />
      <path d="M23.5 29.5 q3 -4.2 6 0 M34.5 29.5 q3 -4.2 6 0" {...stroke} />
      <path d="M26.5 36 q5.5 6.4 11 0 Z" fill={INK} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={23} cy={36} r={2.6} fill={CHEEK} opacity={0.6} />
      <circle cx={41} cy={36} r={2.6} fill={CHEEK} opacity={0.6} />
    </>
  ),
  // 구름 조금: 해가 구름 뒤에서 내다본다. 구름이 살짝 웃는다.
  partly: (
    <>
      <g stroke="#ffa800" strokeWidth={3.2} strokeLinecap="round">
        <path d="M22 4.5 V9 M10.5 9 L13.6 12.2 M5 21 H9.5 M33.5 9 L30.4 12.2" />
      </g>
      <circle cx={21} cy={22} r={11.5} fill="#ffcb3d" />
      <Cloud fill="#f6f9ff" shade="#d4def0" x={2} y={6} />
      <circle cx={31} cy={44.5} r={1.9} fill={INK} />
      <circle cx={43} cy={44.5} r={1.9} fill={INK} />
      <path d="M33.5 49 q3.5 3.4 7 0" {...stroke} />
    </>
  ),
  // 흐림: 덤덤한 구름. 눈은 점이고 입은 일자다.
  cloud: (
    <>
      <Cloud fill="#d3dcec" shade="#b4c1d9" y={3} />
      <circle cx={27} cy={41} r={2} fill={INK} />
      <circle cx={40} cy={41} r={2} fill={INK} />
      <path d="M30 47 H37" {...stroke} />
    </>
  ),
  // 비: 처진 눈썹과 입꼬리의 구름 아래로 빗방울이 떨어진다.
  rain: (
    <>
      <Cloud fill="#a9b9d6" shade="#8c9fc2" y={-6} />
      <path d="M23.5 31 L29 28.8 M38 28.8 L43.5 31" {...stroke} strokeWidth={2.2} />
      <circle cx={27} cy={34.5} r={2} fill={INK} />
      <circle cx={40} cy={34.5} r={2} fill={INK} />
      <path d="M29.5 41 q3.5 -3.2 7 0" {...stroke} />
      <g fill="#4f86ee">
        {[
          [22, 49],
          [33, 53],
          [44, 49],
        ].map(([x, y]) => (
          <path key={x} d={`M${x} ${y} q-3.2 4.2 0 6.6 q3.2 -2.4 0 -6.6z`} />
        ))}
      </g>
    </>
  ),
  // 천둥: 눈썹을 치켜세운 먹구름 아래로 번개가 친다.
  storm: (
    <>
      <Cloud fill="#7f89a8" shade="#646f90" y={-8} />
      <path d="M23.5 25.5 L29.5 28.6 M37.5 28.6 L43.5 25.5" {...stroke} strokeWidth={2.4} />
      <circle cx={27} cy={31.5} r={2} fill={INK} />
      <circle cx={40} cy={31.5} r={2} fill={INK} />
      <path d="M29.5 38 q3.5 -3.4 7 0" {...stroke} />
      <path d="M36 42 L27 54 H33.5 L30 63 L42 49 H35.5 Z" fill="#ffcb3d" stroke="#ffa800" strokeWidth={1.6} strokeLinejoin="round" />
    </>
  ),
  // 밤: 졸린 달. 눈이 감겼고 z가 떠오른다.
  moon: (
    <>
      <circle cx={30} cy={34} r={19} fill="#ffe28a" />
      <circle cx={21} cy={43} r={3.6} fill="#f6cd62" opacity={0.7} />
      <circle cx={38} cy={44} r={2.2} fill="#f6cd62" opacity={0.7} />
      <path d="M22 32 q3.2 3.4 6.4 0 M32 32 q3.2 3.4 6.4 0" {...stroke} />
      <ellipse cx={30} cy={40.5} rx={2.2} ry={2.8} fill={INK} />
      <path d="M43.5 12 h6.5 l-6.5 7.5 h6.5" {...stroke} stroke="#7b6be0" strokeWidth={2.6} />
      <path d="M53 5 h4.4 l-4.4 5.2 h4.4" {...stroke} stroke="#7b6be0" strokeWidth={2.2} />
      <path d="M11 11.5 l1.5 3.3 3.3 1.5 -3.3 1.5 -1.5 3.3 -1.5 -3.3 -3.3 -1.5 3.3 -1.5z" fill="#ffe28a" />
    </>
  ),
};

/** 마음 날씨 그림 하나. 정사각형 size(px) 칸에 그린다. 이름은 감싸는 쪽이 붙이고 여기서는 화면 읽기에서 숨긴다. */
export function MoodIcon({ mood, size = 48 }: { mood: DiaryMoodKey; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
      {ICONS[mood]}
    </svg>
  );
}
