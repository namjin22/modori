-- 학년·반 열. 처음 계획만 하고 어디서도 쓰지 않았고 운영 값도 모두 비어 있다(2026-09-28 개인정보 점검).
-- 사용자 승인(2026-09-29)을 받고 지운다. 지워지는 값은 없다.
ALTER TABLE "User" DROP COLUMN "grade",
DROP COLUMN "classNum";
