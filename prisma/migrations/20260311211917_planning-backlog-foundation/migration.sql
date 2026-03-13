-- CreateTable
CREATE TABLE "PlanWorkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetIteration" TEXT,
    "owner" TEXT,
    "auditWorkflowRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanWorkItemTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanWorkItemTask_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "PlanWorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanAcceptanceCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanAcceptanceCriterion_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "PlanWorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "auditWorkflowRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanRun_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "PlanWorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planRunId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanStep_planRunId_fkey" FOREIGN KEY ("planRunId") REFERENCES "PlanRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemDependency" (
    "blockedWorkItemId" TEXT NOT NULL,
    "blockingWorkItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("blockedWorkItemId", "blockingWorkItemId"),
    CONSTRAINT "WorkItemDependency_blockedWorkItemId_fkey" FOREIGN KEY ("blockedWorkItemId") REFERENCES "PlanWorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemDependency_blockingWorkItemId_fkey" FOREIGN KEY ("blockingWorkItemId") REFERENCES "PlanWorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanWorkItem_sequence_key" ON "PlanWorkItem"("sequence");

-- CreateIndex
CREATE INDEX "PlanWorkItem_priority_idx" ON "PlanWorkItem"("priority");

-- CreateIndex
CREATE INDEX "PlanWorkItem_status_idx" ON "PlanWorkItem"("status");

-- CreateIndex
CREATE INDEX "PlanWorkItem_updatedAt_idx" ON "PlanWorkItem"("updatedAt");

-- CreateIndex
CREATE INDEX "PlanWorkItemTask_workItemId_idx" ON "PlanWorkItemTask"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanWorkItemTask_workItemId_sequence_key" ON "PlanWorkItemTask"("workItemId", "sequence");

-- CreateIndex
CREATE INDEX "PlanAcceptanceCriterion_workItemId_idx" ON "PlanAcceptanceCriterion"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAcceptanceCriterion_workItemId_sequence_key" ON "PlanAcceptanceCriterion"("workItemId", "sequence");

-- CreateIndex
CREATE INDEX "PlanRun_workItemId_idx" ON "PlanRun"("workItemId");

-- CreateIndex
CREATE INDEX "PlanRun_status_idx" ON "PlanRun"("status");

-- CreateIndex
CREATE INDEX "PlanStep_planRunId_idx" ON "PlanStep"("planRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanStep_planRunId_sequence_key" ON "PlanStep"("planRunId", "sequence");

-- CreateIndex
CREATE INDEX "WorkItemDependency_blockingWorkItemId_idx" ON "WorkItemDependency"("blockingWorkItemId");
