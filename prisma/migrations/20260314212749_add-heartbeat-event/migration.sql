-- CreateTable
CREATE TABLE "HeartbeatEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "workItemId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "HeartbeatEvent_runId_createdAt_idx" ON "HeartbeatEvent"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "HeartbeatEvent_workItemId_createdAt_idx" ON "HeartbeatEvent"("workItemId", "createdAt");
