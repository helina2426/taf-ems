/*
  Warnings:

  - A unique constraint covering the columns `[evaluationId,kpiId]` on the table `EvaluationScore` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EvaluationRating" AS ENUM ('EXCEEDS', 'SUCCESSFULLY_MEETS', 'PARTIALLY_MEETS', 'DOES_NOT_MEET');

-- DropForeignKey
ALTER TABLE "EvaluationScore" DROP CONSTRAINT "EvaluationScore_criterionId_fkey";

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "behaviourScore" DECIMAL(5,2),
ADD COLUMN     "rating" "EvaluationRating",
ADD COLUMN     "resultsScore" DECIMAL(5,2),
ADD COLUMN     "resultsShare" INTEGER,
ADD COLUMN     "safetyCapApplied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EvaluationScore" ADD COLUMN     "achievementPercent" DECIMAL(5,1),
ADD COLUMN     "actualUsed" DECIMAL(14,2),
ADD COLUMN     "kpiId" UUID,
ADD COLUMN     "monthsUsed" INTEGER,
ADD COLUMN     "targetUsed" DECIMAL(14,2),
ALTER COLUMN "criterionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_kpiId_key" ON "EvaluationScore"("evaluationId", "kpiId");

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
