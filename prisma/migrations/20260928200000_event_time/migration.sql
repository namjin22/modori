-- 일정 시간(자정부터 분, 0~1439). 비어 있으면 하루 종일. 열만 더한다.
ALTER TABLE "Event" ADD COLUMN "startTime" INTEGER,
ADD COLUMN "endTime" INTEGER;
