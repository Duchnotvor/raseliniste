-- CreateTable
CREATE TABLE "HealthMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "unit" TEXT,
    "qty" DOUBLE PRECISION,
    "bpSystolic" DOUBLE PRECISION,
    "bpDiastolic" DOUBLE PRECISION,
    "sleepData" JSONB,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthEcg" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "classification" TEXT,
    "averageHr" DOUBLE PRECISION,
    "voltageData" JSONB NOT NULL,
    "symptoms" JSONB,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthEcg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthMetric_userId_type_recordedAt_idx" ON "HealthMetric"("userId", "type", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthMetric_userId_type_recordedAt_source_key" ON "HealthMetric"("userId", "type", "recordedAt", "source");

-- CreateIndex
CREATE INDEX "HealthEcg_userId_startedAt_idx" ON "HealthEcg"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HealthEcg_userId_startedAt_source_key" ON "HealthEcg"("userId", "startedAt", "source");

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEcg" ADD CONSTRAINT "HealthEcg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
