import { Dori } from "@/components/dori";
import { doriMoodOf } from "@/lib/reactions";

/**
 * 반응 하나의 그림. 도리 반응은 도리 얼굴로, 나머지는 이모지 글자로 그린다.
 * 이모지는 둘레의 글자 크기를 따르고, 도리는 doriSize(px)로 그린다.
 * 이름은 감싸는 버튼이나 칸이 붙인다. 여기서는 화면 읽기에서 숨긴다.
 *
 * 반응 줄(클라이언트)과 받은 반응 화면(서버)이 같이 쓰므로 훅을 두지 않는다.
 */
export function ReactionGlyph({ value, doriSize }: { value: string; doriSize: number }) {
  const mood = doriMoodOf(value);
  if (mood) return <Dori mood={mood} size={doriSize} />;

  return <span aria-hidden>{value}</span>;
}
