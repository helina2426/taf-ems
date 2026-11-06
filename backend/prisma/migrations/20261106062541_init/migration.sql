-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HOLDING', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SelfAssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('EMPLOYEE', 'MANAGER');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'RETURNED');

-- CreateTable
CREATE TABLE "Holding" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "holdingId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isPrimaryHoldingUser" BOOLEAN NOT NULL DEFAULT false,
    "canApproveEvaluations" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "hireDate" DATE,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerAssignment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "managerUserId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceGoal" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "periodId" UUID,
    "createdById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT,
    "kpi" TEXT,
    "targetResult" TEXT,
    "deadline" DATE,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalProgressUpdate" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPeriod" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "appliesTo" "EvaluationType" NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfAssessment" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "comments" TEXT,
    "status" "SelfAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "evaluatorId" UUID NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "overallScore" DECIMAL(5,2),
    "feedback" TEXT,
    "recommendations" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "employeeComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "weightUsed" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationReview" (
    "id" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" UUID,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_holdingId_idx" ON "Company"("holdingId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_employeeNumber_key" ON "Employee"("companyId", "employeeNumber");

-- CreateIndex
CREATE INDEX "ManagerAssignment_companyId_idx" ON "ManagerAssignment"("companyId");

-- CreateIndex
CREATE INDEX "ManagerAssignment_managerUserId_idx" ON "ManagerAssignment"("managerUserId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_employeeId_idx" ON "PerformanceGoal"("employeeId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_periodId_idx" ON "PerformanceGoal"("periodId");

-- CreateIndex
CREATE INDEX "GoalProgressUpdate_goalId_idx" ON "GoalProgressUpdate"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationPeriod_name_key" ON "EvaluationPeriod"("name");

-- CreateIndex
CREATE INDEX "EvaluationCriterion_appliesTo_isActive_idx" ON "EvaluationCriterion"("appliesTo", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SelfAssessment_employeeId_periodId_key" ON "SelfAssessment"("employeeId", "periodId");

-- CreateIndex
CREATE INDEX "Evaluation_companyId_status_idx" ON "Evaluation"("companyId", "status");

-- CreateIndex
CREATE INDEX "Evaluation_periodId_idx" ON "Evaluation"("periodId");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatorId_idx" ON "Evaluation"("evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_employeeId_periodId_key" ON "Evaluation"("employeeId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_criterionId_key" ON "EvaluationScore"("evaluationId", "criterionId");

-- CreateIndex
CREATE INDEX "EvaluationReview_evaluationId_idx" ON "EvaluationReview"("evaluationId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAssignment" ADD CONSTRAINT "ManagerAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAssignment" ADD CONSTRAINT "ManagerAssignment_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAssignment" ADD CONSTRAINT "ManagerAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EvaluationPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgressUpdate" ADD CONSTRAINT "GoalProgressUpdate_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PerformanceGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgressUpdate" ADD CONSTRAINT "GoalProgressUpdate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPeriod" ADD CONSTRAINT "EvaluationPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessment" ADD CONSTRAINT "SelfAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessment" ADD CONSTRAINT "SelfAssessment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EvaluationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "EvaluationPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationReview" ADD CONSTRAINT "EvaluationReview_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationReview" ADD CONSTRAINT "EvaluationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
