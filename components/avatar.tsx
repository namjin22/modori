import { Dori } from "@/components/dori";

/**
 * 사람 자리에 들어가는 동그란 그림. 올린 사진이 없으면 도리 얼굴을 쓴다.
 * 사진은 저장할 때 128×128로 줄여 둔 data URL이라 따로 받아올 게 없다.
 */
export function Avatar({
  src,
  size = 40,
  className = "",
}: {
  src: string | null;
  size?: number;
  className?: string;
}) {
  const round = "shrink-0 rounded-full object-cover";

  if (src) {
    return (
      // 사용자가 올린 data URL이라 next/image의 최적화가 할 일이 없다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`${round} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return <DoriFace size={size} className={`${round} ${className}`} />;
}

/**
 * 기본 프로필 그림. 화면 곳곳의 도리와 같은 얼굴을 쓴다.
 * 배경은 테마의 옅은 브랜드색이라 밝은 테마에서는 연한 하늘색, 어두운 테마에서는 짙은 남색이 된다.
 */
export function DoriFace({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-avatar="dori"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-brand-subtle ${className}`}
      style={{ width: size, height: size }}
    >
      <Dori mood="happy" size={size} crop />
    </span>
  );
}
