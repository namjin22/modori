-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "isPublic" SET DEFAULT true,
ALTER COLUMN "memoPublic" SET DEFAULT true;

-- AlterTable
ALTER TABLE "EventRoutine" ALTER COLUMN "isPublic" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Todo" ALTER COLUMN "memoPublic" SET DEFAULT true;

-- 메모가 없는 할 일·일정은 숨길 메모가 없다. 나중에 메모를 적으면 새 기본(공개)을 따르게 한다(2026-10-18).
-- 메모가 있는 것은 "나만 봐요"로 약속하고 적은 것이라 그대로 비공개로 둔다. 지우는 데이터는 없다.
UPDATE "Todo" SET "memoPublic" = true WHERE "memo" IS NULL;
UPDATE "Event" SET "memoPublic" = true WHERE "memo" IS NULL;
