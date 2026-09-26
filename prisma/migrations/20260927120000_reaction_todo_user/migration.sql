-- 받은 반응을 할 일 테이블을 거치지 않고 찾기 위해 할 일 주인을 반응에 같이 적는다.
-- 기존 행은 할 일에서 채운 뒤 필수로 바꾼다. 지우는 데이터는 없다.
ALTER TABLE "Reaction" ADD COLUMN "todoUserId" TEXT;

UPDATE "Reaction" AS r
SET "todoUserId" = t."userId"
FROM "Todo" AS t
WHERE t."id" = r."todoId";

ALTER TABLE "Reaction" ALTER COLUMN "todoUserId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Reaction_todoUserId_createdAt_idx" ON "Reaction"("todoUserId", "createdAt");
