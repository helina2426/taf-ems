-- AlterTable
ALTER TABLE "KpiMonth" ADD COLUMN     "actual" DECIMAL(14,2),
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" UUID,
ADD COLUMN     "enteredAt" TIMESTAMP(3),
ADD COLUMN     "enteredById" UUID;

-- CreateTable
CREATE TABLE "ProgressReview" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "ownerComment" TEXT,
    "ownerCommentAt" TIMESTAMP(3),
    "reviewerComment" TEXT,
    "reviewerId" UUID,
    "reviewerCommentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgressReview_periodId_idx" ON "ProgressReview"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressReview_planId_periodId_key" ON "ProgressReview"("planId", "periodId");

-- AddForeignKey
ALTER TABLE "KpiMonth" ADD CONSTRAINT "KpiMonth_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiMonth" ADD CONSTRAINT "KpiMonth_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressReview" ADD CONSTRAINT "ProgressReview_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressReview" ADD CONSTRAINT "ProgressReview_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EvaluationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressReview" ADD CONSTRAINT "ProgressReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
