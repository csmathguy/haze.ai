-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN "workItemId" TEXT;

-- CreateIndex
CREATE INDEX "WorkflowRun_workItemId_idx" ON "WorkflowRun"("workItemId");
