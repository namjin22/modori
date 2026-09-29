-- 일정마다 D-day를 보일지. 열 추가만 하고, 기존 일정은 지금처럼 보이게(true) 둔다.
ALTER TABLE "Event" ADD COLUMN "dday" BOOLEAN NOT NULL DEFAULT true;
