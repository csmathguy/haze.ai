-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvents" TEXT NOT NULL,
    "definitionJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "definitionName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentStep" TEXT,
    "contextJson" TEXT,
    "correlationId" TEXT,
    "parentRunId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "WorkflowStepRun" (
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
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "payload" TEXT NOT NULL,
    "metadata" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "WorkflowApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "responseJson" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "allowedSkillIds" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "inputSchema" TEXT,
    "outputSchema" TEXT,
    "executionMode" TEXT NOT NULL DEFAULT 'agent',
    "permissions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExternalEventSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "configJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WorkflowDefinition_name_idx" ON "WorkflowDefinition"("name");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_status_idx" ON "WorkflowDefinition"("status");

-- CreateIndex
CREATE INDEX "WorkflowRun_definitionId_idx" ON "WorkflowRun"("definitionId");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "WorkflowRun_correlationId_idx" ON "WorkflowRun"("correlationId");

-- CreateIndex
CREATE INDEX "WorkflowRun_parentRunId_idx" ON "WorkflowRun"("parentRunId");

-- CreateIndex
CREATE INDEX "WorkflowRun_startedAt_idx" ON "WorkflowRun"("startedAt");

-- CreateIndex
CREATE INDEX "WorkflowStepRun_runId_idx" ON "WorkflowStepRun"("runId");

-- CreateIndex
CREATE INDEX "WorkflowStepRun_stepId_idx" ON "WorkflowStepRun"("stepId");

-- CreateIndex
CREATE INDEX "WorkflowStepRun_startedAt_idx" ON "WorkflowStepRun"("startedAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_type_idx" ON "WorkflowEvent"("type");

-- CreateIndex
CREATE INDEX "WorkflowEvent_source_idx" ON "WorkflowEvent"("source");

-- CreateIndex
CREATE INDEX "WorkflowEvent_correlationId_idx" ON "WorkflowEvent"("correlationId");

-- CreateIndex
CREATE INDEX "WorkflowEvent_occurredAt_idx" ON "WorkflowEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "WorkflowApproval_runId_idx" ON "WorkflowApproval"("runId");

-- CreateIndex
CREATE INDEX "WorkflowApproval_stepId_idx" ON "WorkflowApproval"("stepId");

-- CreateIndex
CREATE INDEX "WorkflowApproval_status_idx" ON "WorkflowApproval"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_name_key" ON "Agent"("name");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_tier_idx" ON "Agent"("tier");

-- CreateIndex
CREATE INDEX "Skill_status_idx" ON "Skill"("status");

-- CreateIndex
CREATE INDEX "Skill_category_idx" ON "Skill"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_version_key" ON "Skill"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEventSource_name_key" ON "ExternalEventSource"("name");

-- CreateIndex
CREATE INDEX "ExternalEventSource_status_idx" ON "ExternalEventSource"("status");

-- CreateIndex
CREATE INDEX "ExternalEventSource_type_idx" ON "ExternalEventSource"("type");
