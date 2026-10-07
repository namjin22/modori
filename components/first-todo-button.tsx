"use client";

/**
 * 할 일이 하나도 없는 화면의 큰 버튼. 처음 온 사람은 위의 작은 카테고리 칩이 입력칸을 여는 버튼인 줄 몰라서 그냥 나갔다
 * (공개 첫날 가입 40명 중 35명이 할 일을 한 번도 안 썼다). 누르면 첫 카테고리의 입력칸이 열리고 포커스가 간다.
 * 입력칸은 카테고리 칩(components/category-adder.tsx)이 가진 상태라, 그 칩을 눌러 주는 방식으로 연다.
 */
export function FirstTodoButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const chip = document.querySelector<HTMLButtonElement>('button[aria-label$="에 할 일 쓰기"][aria-expanded="false"]');
        // 이미 열려 있으면 그 입력칸에 포커스만 준다.
        const opened = document.querySelector<HTMLInputElement>('input[aria-label$="할 일"]');
        if (chip) chip.click();
        else opened?.focus();
        // 입력칸이 열린 뒤에(다음 그림) 보이는 자리로 올리고 포커스를 준다.
        requestAnimationFrame(() => {
          const input = document.querySelector<HTMLInputElement>('input[aria-label$="할 일"]');
          input?.scrollIntoView({ block: "center", behavior: "smooth" });
          input?.focus();
        });
      }}
      className="mt-3 h-12 rounded-2xl bg-brand px-6 text-base font-semibold text-brand-contrast transition-colors hover:bg-brand-hover active:scale-[0.98]"
    >
      첫 할 일 적기
    </button>
  );
}
