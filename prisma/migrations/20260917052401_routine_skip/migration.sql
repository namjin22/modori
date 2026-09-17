-- 루틴 할 일을 지운 날을 남긴다. 새 테이블만 만들고 기존 데이터는 건드리지 않는다.
-- CreateTable
CREATE TABLE "RoutineSkip" (
    "routineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineSkip_pkey" PRIMARY KEY ("routineId","date")
);

-- AddForeignKey
ALTER TABLE "RoutineSkip" ADD CONSTRAINT "RoutineSkip_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
