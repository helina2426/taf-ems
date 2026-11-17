/*
  Warnings:

  - A unique constraint covering the columns `[cycleId,type,sequence]` on the table `EvaluationPeriod` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CalendarType" AS ENUM ('ETHIOPIAN', 'GREGORIAN');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('YEAR', 'HALF', 'QUARTER', 'MONTH');

-- AlterTable
ALTER TABLE "EvaluationPeriod" ADD COLUMN     "cycleId" UUID,
ADD COLUMN     "parentId" UUID,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "type" "PeriodType" NOT NULL DEFAULT 'YEAR';

-- AlterTable
ALTER TABLE "Holding" ADD COLUMN     "cycleCalendar" "CalendarType" NOT NULL DEFAULT 'ETHIOPIAN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayCalendar" "CalendarType" NOT NULL DEFAULT 'ETHIOPIAN';

-- CreateTable
CREATE TABLE "PerformanceCycle" (
    "id" UUID NOT NULL,
    "holdingId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "calendar" "CalendarType" NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'PLANNING',
    "employeeResultsShare" INTEGER NOT NULL DEFAULT 70,
    "managerResultsShare" INTEGER NOT NULL DEFAULT 80,
    "minKpis" INTEGER NOT NULL DEFAULT 3,
    "maxKpis" INTEGER NOT NULL DEFAULT 7,
    "minKpiWeight" INTEGER NOT NULL DEFAULT 10,
    "maxKpiWeight" INTEGER NOT NULL DEFAULT 40,
    "achievementCap" INTEGER NOT NULL DEFAULT 120,
    "minMonthsForRating" INTEGER NOT NULL DEFAULT 6,
    "appealDays" INTEGER NOT NULL DEFAULT 14,
    "planDeadlineDays" INTEGER NOT NULL DEFAULT 30,
    "safetyCapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceCycle_name_key" ON "PerformanceCycle"("name");

-- CreateIndex
CREATE INDEX "PerformanceCycle_holdingId_idx" ON "PerformanceCycle"("holdingId");

-- CreateIndex
CREATE INDEX "PerformanceCycle_startDate_idx" ON "PerformanceCycle"("startDate");

-- CreateIndex
CREATE INDEX "EvaluationPeriod_parentId_idx" ON "EvaluationPeriod"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPeriod_cycleId_type_sequence_key" ON "EvaluationPeriod"("cycleId", "type", "sequence");

-- AddForeignKey
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EvaluationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
