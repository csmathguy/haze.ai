-- Add provider family and runtime kind fields to Agent model
ALTER TABLE "Agent" ADD COLUMN "providerFamily" TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE "Agent" ADD COLUMN "runtimeKind" TEXT NOT NULL DEFAULT 'claude-code-subagent';
ALTER TABLE "Agent" ADD COLUMN "configSourcePath" TEXT;

-- Add indexes for the new columns
CREATE INDEX "Agent_providerFamily_idx" ON "Agent"("providerFamily");
CREATE INDEX "Agent_runtimeKind_idx" ON "Agent"("runtimeKind");
