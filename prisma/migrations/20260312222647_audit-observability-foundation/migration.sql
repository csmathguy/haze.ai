-- AlterTable
ALTER TABLE "AuditEventRecord" ADD COLUMN "agentName" TEXT;
ALTER TABLE "AuditEventRecord" ADD COLUMN "project" TEXT;
ALTER TABLE "AuditEventRecord" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "AuditEventRecord" ADD COLUMN "workItemId" TEXT;

-- CreateTable
CREATE TABLE "AuditDecisionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "executionId" TEXT,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rationale" TEXT,
    "selectedOption" TEXT,
    "optionsJson" TEXT,
    "metadataJson" TEXT,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "AuditDecisionRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditDecisionRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AuditExecutionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditArtifactRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "executionId" TEXT,
    "artifactType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "path" TEXT,
    "uri" TEXT,
    "metadataJson" TEXT,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "AuditArtifactRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditArtifactRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AuditExecutionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditFailureRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "executionId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "AuditFailureRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AuditRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditFailureRecord_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AuditExecutionRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "latestEventAt" DATETIME,
    "statsByKindJson" TEXT,
    "statsByStatusJson" TEXT,
    "summaryJson" TEXT
);
INSERT INTO "new_AuditRun" ("actor", "completedAt", "durationMs", "executionCount", "failedExecutionCount", "id", "latestEventAt", "repoPath", "startedAt", "statsByKindJson", "statsByStatusJson", "status", "summaryJson", "task", "workflow", "worktreePath") SELECT "actor", "completedAt", "durationMs", "executionCount", "failedExecutionCount", "id", "latestEventAt", "repoPath", "startedAt", "statsByKindJson", "statsByStatusJson", "status", "summaryJson", "task", "workflow", "worktreePath" FROM "AuditRun";
DROP TABLE "AuditRun";
ALTER TABLE "new_AuditRun" RENAME TO "AuditRun";
CREATE INDEX "AuditRun_workflow_startedAt_idx" ON "AuditRun"("workflow", "startedAt");
CREATE INDEX "AuditRun_status_startedAt_idx" ON "AuditRun"("status", "startedAt");
CREATE INDEX "AuditRun_project_startedAt_idx" ON "AuditRun"("project", "startedAt");
CREATE INDEX "AuditRun_agentName_startedAt_idx" ON "AuditRun"("agentName", "startedAt");
CREATE INDEX "AuditRun_workItemId_startedAt_idx" ON "AuditRun"("workItemId", "startedAt");
CREATE INDEX "AuditRun_worktreePath_startedAt_idx" ON "AuditRun"("worktreePath", "startedAt");
CREATE INDEX "AuditRun_latestEventAt_idx" ON "AuditRun"("latestEventAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditDecisionRecord_runId_timestamp_idx" ON "AuditDecisionRecord"("runId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditDecisionRecord_category_timestamp_idx" ON "AuditDecisionRecord"("category", "timestamp");

-- CreateIndex
CREATE INDEX "AuditDecisionRecord_executionId_timestamp_idx" ON "AuditDecisionRecord"("executionId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditArtifactRecord_runId_timestamp_idx" ON "AuditArtifactRecord"("runId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditArtifactRecord_artifactType_timestamp_idx" ON "AuditArtifactRecord"("artifactType", "timestamp");

-- CreateIndex
CREATE INDEX "AuditArtifactRecord_executionId_timestamp_idx" ON "AuditArtifactRecord"("executionId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditFailureRecord_runId_timestamp_idx" ON "AuditFailureRecord"("runId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditFailureRecord_category_timestamp_idx" ON "AuditFailureRecord"("category", "timestamp");

-- CreateIndex
CREATE INDEX "AuditFailureRecord_severity_timestamp_idx" ON "AuditFailureRecord"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "AuditFailureRecord_executionId_timestamp_idx" ON "AuditFailureRecord"("executionId", "timestamp");
