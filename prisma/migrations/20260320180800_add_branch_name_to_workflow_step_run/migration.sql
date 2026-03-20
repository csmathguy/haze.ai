-- Add branchName field to WorkflowStepRun
ALTER TABLE "WorkflowStepRun" ADD COLUMN "branchName" TEXT;

-- Create index on branchName for querying step runs by branch
CREATE INDEX "WorkflowStepRun_branchName_idx" ON "WorkflowStepRun"("branchName");
