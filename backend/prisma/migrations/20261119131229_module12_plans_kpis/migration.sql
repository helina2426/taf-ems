-- CreateEnum
CREATE TYPE "PlanLevel" AS ENUM ('HOLDING', 'COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "Perspective" AS ENUM ('FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH');

-- CreateEnum
CREATE TYPE "KpiDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'EXACT', 'ZERO');

-- CreateEnum
CREATE TYPE "KpiAggregation" AS ENUM ('SUM', 'AVERAGE', 'LAST');

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "level" "PlanLevel" NOT NULL,
    "scope" TEXT NOT NULL,
    "companyId" UUID,
    "employeeId" UUID,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "returnComment" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgeComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kpi" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "parentKpiId" UUID,
    "perspective" "Perspective" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "direction" "KpiDirection" NOT NULL,
    "aggregation" "KpiAggregation" NOT NULL DEFAULT 'SUM',
    "baseline" DECIMAL(14,2),
    "yearTarget" DECIMAL(14,2) NOT NULL,
    "weight" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiMonth" (
    "id" UUID NOT NULL,
    "kpiId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "target" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_companyId_idx" ON "Plan"("companyId");

-- CreateIndex
CREATE INDEX "Plan_employeeId_idx" ON "Plan"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_cycleId_scope_key" ON "Plan"("cycleId", "scope");

-- CreateIndex
CREATE INDEX "Kpi_planId_idx" ON "Kpi"("planId");

-- CreateIndex
CREATE INDEX "Kpi_parentKpiId_idx" ON "Kpi"("parentKpiId");

-- CreateIndex
CREATE INDEX "KpiMonth_periodId_idx" ON "KpiMonth"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiMonth_kpiId_periodId_key" ON "KpiMonth"("kpiId", "periodId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_parentKpiId_fkey" FOREIGN KEY ("parentKpiId") REFERENCES "Kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiMonth" ADD CONSTRAINT "KpiMonth_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiMonth" ADD CONSTRAINT "KpiMonth_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EvaluationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
