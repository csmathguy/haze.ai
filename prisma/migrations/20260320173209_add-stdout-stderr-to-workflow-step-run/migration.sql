-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkflowStepRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "agentId" TEXT,
    "model" TEXT,
    "skillIds" TEXT,
    "inputJson" TEXT,
    "outputJson" TEXT,
    "errorJson" TEXT,
    "stdout" TEXT,
    "stderr" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "WorkflowStepRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkflowStepRun" ("agentId", "completedAt", "errorJson", "id", "inputJson", "model", "nodeType", "outputJson", "retryCount", "runId", "skillIds", "startedAt", "stepId", "stepType") SELECT "agentId", "completedAt", "errorJson", "id", "inputJson", "model", "nodeType", "outputJson", "retryCount", "runId", "skillIds", "startedAt", "stepId", "stepType" FROM "WorkflowStepRun";
DROP TABLE "WorkflowStepRun";
ALTER TABLE "new_WorkflowStepRun" RENAME TO "WorkflowStepRun";
CREATE INDEX "WorkflowStepRun_runId_idx" ON "WorkflowStepRun"("runId");
CREATE INDEX "WorkflowStepRun_stepId_idx" ON "WorkflowStepRun"("stepId");
CREATE INDEX "WorkflowStepRun_startedAt_idx" ON "WorkflowStepRun"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
