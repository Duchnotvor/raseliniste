-- CreateEnum
CREATE TYPE "AnalysisTrigger" AS ENUM ('MANUAL', 'MONTHLY_AUTO');

-- CreateTable
CREATE TABLE "HealthAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "focus" TEXT,
    "trigger" "AnalysisTrigger" NOT NULL DEFAULT 'MANUAL',
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptChars" INTEGER,
    "totalSamples" INTEGER,
    "metricsWithData" INTEGER,
    "emailSentAt" TIMESTAMP(3),
    "emailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthAnalysis_userId_createdAt_idx" ON "HealthAnalysis"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HealthAnalysis_userId_periodFrom_periodTo_idx" ON "HealthAnalysis"("userId", "periodFrom", "periodTo");

-- AddForeignKey
ALTER TABLE "HealthAnalysis" ADD CONSTRAINT "HealthAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
