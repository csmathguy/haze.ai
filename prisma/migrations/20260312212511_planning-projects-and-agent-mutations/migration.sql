-- CreateTable
CREATE TABLE "PlanProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "PlanProject" ("id", "key", "name", "description", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES (
    'plan-project-planning',
    'planning',
    'Planning',
    'Planning systems, agent workflows, backlog hygiene, and delivery orchestration.',
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanWorkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetIteration" TEXT,
    "owner" TEXT,
    "auditWorkflowRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanWorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PlanProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PlanWorkItem" ("auditWorkflowRunId", "createdAt", "id", "kind", "owner", "priority", "projectId", "sequence", "status", "summary", "targetIteration", "title", "updatedAt")
SELECT "auditWorkflowRunId", "createdAt", "id", "kind", "owner", "priority", 'plan-project-planning', "sequence", "status", "summary", "targetIteration", "title", "updatedAt"
FROM "PlanWorkItem";
DROP TABLE "PlanWorkItem";
ALTER TABLE "new_PlanWorkItem" RENAME TO "PlanWorkItem";
CREATE UNIQUE INDEX "PlanWorkItem_sequence_key" ON "PlanWorkItem"("sequence");
CREATE INDEX "PlanWorkItem_projectId_idx" ON "PlanWorkItem"("projectId");
CREATE INDEX "PlanWorkItem_priority_idx" ON "PlanWorkItem"("priority");
CREATE INDEX "PlanWorkItem_status_idx" ON "PlanWorkItem"("status");
CREATE INDEX "PlanWorkItem_updatedAt_idx" ON "PlanWorkItem"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PlanProject_key_key" ON "PlanProject"("key");

-- CreateIndex
CREATE INDEX "PlanProject_isActive_sortOrder_idx" ON "PlanProject"("isActive", "sortOrder");
