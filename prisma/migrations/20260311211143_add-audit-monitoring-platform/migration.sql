-- CreateTable
CREATE TABLE "AuditRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow" TEXT NOT NULL,
    "task" TEXT,
    "actor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "repoPath" TEXT,
    "worktreePath" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "failedExecutionCount" INTEGER NOT NULL DEFAULT 0,
    "latestEventAt" DATETIME,
    "statsByKindJson" TEXT,
    "statsByStatusJson" TEXT,
    "summaryJson" TEXT
);

-- CreateTable
CREATE TABLE "AuditExecutionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "parentExecutionId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "step" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "exitCode" INTEGER,
    "errorName" TEXT,
    "errorMessage" TEXT,
    "commandJson" TEXT,
    "metadataJson" TEXT,
    "logFile" TEXT,
    CONSTRAINT "AuditExecutionRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditExecutionRecord_parentExecutionId_fkey" FOREIGN KEY ("parentExecutionId") REFERENCES "AuditExecutionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEventRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "executionId" TEXT,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "cwd" TEXT NOT NULL,
    "status" TEXT,
    "step" TEXT,
    "task" TEXT,
    "timestamp" DATETIME NOT NULL,
    "durationMs" INTEGER,
    "exitCode" INTEGER,
    "errorName" TEXT,
    "errorMessage" TEXT,
    "logFile" TEXT,
    "commandJson" TEXT,
    "metadataJson" TEXT,
    "executionKind" TEXT,
    "executionName" TEXT,
    "parentExecutionId" TEXT,
    "workflow" TEXT NOT NULL,
    CONSTRAINT "AuditEventRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditEventRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AuditExecutionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuditRun_workflow_startedAt_idx" ON "AuditRun"("workflow", "startedAt");

-- CreateIndex
CREATE INDEX "AuditRun_status_startedAt_idx" ON "AuditRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AuditRun_worktreePath_startedAt_idx" ON "AuditRun"("worktreePath", "startedAt");

-- CreateIndex
CREATE INDEX "AuditRun_latestEventAt_idx" ON "AuditRun"("latestEventAt");

-- CreateIndex
CREATE INDEX "AuditExecutionRecord_runId_startedAt_idx" ON "AuditExecutionRecord"("runId", "startedAt");

-- CreateIndex
CREATE INDEX "AuditExecutionRecord_kind_startedAt_idx" ON "AuditExecutionRecord"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "AuditExecutionRecord_status_startedAt_idx" ON "AuditExecutionRecord"("status", "startedAt");

-- CreateIndex
CREATE INDEX "AuditExecutionRecord_parentExecutionId_idx" ON "AuditExecutionRecord"("parentExecutionId");

-- CreateIndex
CREATE INDEX "AuditEventRecord_runId_timestamp_idx" ON "AuditEventRecord"("runId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEventRecord_executionId_timestamp_idx" ON "AuditEventRecord"("executionId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEventRecord_timestamp_idx" ON "AuditEventRecord"("timestamp");

-- CreateIndex
CREATE INDEX "AuditEventRecord_workflow_timestamp_idx" ON "AuditEventRecord"("workflow", "timestamp");
