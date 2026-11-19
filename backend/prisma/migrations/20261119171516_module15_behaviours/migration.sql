-- AlterTable
ALTER TABLE "EvaluationCriterion" ADD COLUMN     "isSafety" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "levelDescriptions" JSONB;
