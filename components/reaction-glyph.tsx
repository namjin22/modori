import { Dori } from "@/components/dori";
import { characterMoodOf } from "@/lib/reactions";

/**
 * 반응 하나의 그림. 캐릭터 반응은 그 캐릭터의 표정으로, 나머지는 이모지 글자로 그린다.
 *
 * 둘 다 같은 size(px) 정사각형 칸에 넣는다. 예전에는 이모지가 둘레 글자 크기(12~14px)를 따르고
 * 도리는 22~26px로 그려서 칩마다 크기가 달랐다. 도리 그림은 칸의 65%쯤이 얼굴이라, 이모지도
 * 그만한 크기(칸의 70%)로 맞춘다.
 * 이름은 감싸는 버튼이나 칸이 붙인다. 여기서는 화면 읽기에서 숨긴다.
 *
 * 반응 줄(클라이언트)과 받은 반응 화면(서버)이 같이 쓰므로 훅을 두지 않는다.
 */
export function ReactionGlyph({ value, size }: { value: string; size: number }) {
  const found = characterMoodOf(value);

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center leading-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.7) }}
    >
      {found ? <Dori mood={found.mood} character={found.character} size={size} /> : value}
    </span>
  );
}
