-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('SUBMITTED', 'DECIDED');

-- CreateEnum
CREATE TYPE "AppealOutcome" AS ENUM ('RATING_KEPT', 'RATING_CHANGED');

-- CreateTable
CREATE TABLE "EvaluationAppeal" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'SUBMITTED',
    "originalRating" "EvaluationRating" NOT NULL,
    "originalScore" DECIMAL(5,2) NOT NULL,
    "outcome" "AppealOutcome",
    "newRating" "EvaluationRating",
    "newScore" DECIMAL(5,2),
    "decisionComment" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationAppeal_evaluationId_key" ON "EvaluationAppeal"("evaluationId");

-- CreateIndex
CREATE INDEX "EvaluationAppeal_status_idx" ON "EvaluationAppeal"("status");

-- AddForeignKey
ALTER TABLE "EvaluationAppeal" ADD CONSTRAINT "EvaluationAppeal_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationAppeal" ADD CONSTRAINT "EvaluationAppeal_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
