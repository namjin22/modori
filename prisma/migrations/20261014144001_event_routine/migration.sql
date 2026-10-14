-- CreateTable
CREATE TABLE "EventRoutine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "startTime" INTEGER,
    "endTime" INTEGER,
    "freq" "RoutineFreq" NOT NULL,
    "byWeekday" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "byMonthday" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRoutineSkip" (
    "eventRoutineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRoutineSkip_pkey" PRIMARY KEY ("eventRoutineId","date")
);

-- CreateIndex
CREATE INDEX "EventRoutine_userId_idx" ON "EventRoutine"("userId");

-- AddForeignKey
ALTER TABLE "EventRoutine" ADD CONSTRAINT "EventRoutine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRoutineSkip" ADD CONSTRAINT "EventRoutineSkip_eventRoutineId_fkey" FOREIGN KEY ("eventRoutineId") REFERENCES "EventRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
