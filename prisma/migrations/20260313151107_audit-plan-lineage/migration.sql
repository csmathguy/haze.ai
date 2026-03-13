-- AlterTable
ALTER TABLE "AuditEventRecord" ADD COLUMN "planRunId" TEXT;
ALTER TABLE "AuditEventRecord" ADD COLUMN "planStepId" TEXT;

-- CreateTable
CREATE TABLE "AuditHandoffRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "executionId" TEXT,
    "workItemId" TEXT,
    "planRunId" TEXT,
    "planStepId" TEXT,
    "sourceAgent" TEXT NOT NULL,
    "targetAgent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "artifactIdsJson" TEXT,
    "metadataJson" TEXT,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "AuditHandoffRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditHandoffRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AuditExecutionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflow" TEXT NOT NULL,
    "task" TEXT,
    "actor" TEXT NOT NULL,
    "agentName" TEXT,
    "planRunId" TEXT,
    "planStepId" TEXT,
    "project" TEXT,
    "sessionId" TEXT,
    "workItemId" TEXT,
    "status" TEXT NOT NULL,
    "repoPath" TEXT,
    "worktreePath" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "failedExecutionCount" INTEGER NOT NULL DEFAULT 0,
    "decisionCount" INTEGER NOT NULL DEFAULT 0,
    "artifactCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "handoffCount" INTEGER NOT NULL DEFAULT 0,
    "latestEventAt" DATETIME,
    "statsByKindJson" TEXT,
    "statsByStatusJson" TEXT,
    "summaryJson" TEXT
);
INSERT INTO "new_AuditRun" ("actor", "agentName", "artifactCount", "completedAt", "decisionCount", "durationMs", "executionCount", "failedExecutionCount", "failureCount", "id", "latestEventAt", "project", "repoPath", "sessionId", "startedAt", "statsByKindJson", "statsByStatusJson", "status", "summaryJson", "task", "workItemId", "workflow", "worktreePath") SELECT "actor", "agentName", "artifactCount", "completedAt", "decisionCount", "durationMs", "executionCount", "failedExecutionCount", "failureCount", "id", "latestEventAt", "project", "repoPath", "sessionId", "startedAt", "statsByKindJson", "statsByStatusJson", "status", "summaryJson", "task", "workItemId", "workflow", "worktreePath" FROM "AuditRun";
DROP TABLE "AuditRun";
ALTER TABLE "new_AuditRun" RENAME TO "AuditRun";
CREATE INDEX "AuditRun_workflow_startedAt_idx" ON "AuditRun"("workflow", "startedAt");
CREATE INDEX "AuditRun_status_startedAt_idx" ON "AuditRun"("status", "startedAt");
CREATE INDEX "AuditRun_project_startedAt_idx" ON "AuditRun"("project", "startedAt");
CREATE INDEX "AuditRun_agentName_startedAt_idx" ON "AuditRun"("agentName", "startedAt");
CREATE INDEX "AuditRun_workItemId_startedAt_idx" ON "AuditRun"("workItemId", "startedAt");
CREATE INDEX "AuditRun_planRunId_startedAt_idx" ON "AuditRun"("planRunId", "startedAt");
CREATE INDEX "AuditRun_planStepId_startedAt_idx" ON "AuditRun"("planStepId", "startedAt");
CREATE INDEX "AuditRun_worktreePath_startedAt_idx" ON "AuditRun"("worktreePath", "startedAt");
CREATE INDEX "AuditRun_latestEventAt_idx" ON "AuditRun"("latestEventAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_runId_timestamp_idx" ON "AuditHandoffRecord"("runId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_workItemId_timestamp_idx" ON "AuditHandoffRecord"("workItemId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_planRunId_timestamp_idx" ON "AuditHandoffRecord"("planRunId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_planStepId_timestamp_idx" ON "AuditHandoffRecord"("planStepId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_sourceAgent_timestamp_idx" ON "AuditHandoffRecord"("sourceAgent", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_targetAgent_timestamp_idx" ON "AuditHandoffRecord"("targetAgent", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_status_timestamp_idx" ON "AuditHandoffRecord"("status", "timestamp");

-- CreateIndex
CREATE INDEX "AuditHandoffRecord_executionId_timestamp_idx" ON "AuditHandoffRecord"("executionId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEventRecord_workItemId_timestamp_idx" ON "AuditEventRecord"("workItemId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEventRecord_planRunId_timestamp_idx" ON "AuditEventRecord"("planRunId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditEventRecord_planStepId_timestamp_idx" ON "AuditEventRecord"("planStepId", "timestamp");
