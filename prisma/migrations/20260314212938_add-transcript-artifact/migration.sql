-- CreateTable
CREATE TABLE "TranscriptArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "workItemId" TEXT,
    "filePath" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lineCount" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptArtifact_runId_key" ON "TranscriptArtifact"("runId");

-- CreateIndex
CREATE INDEX "TranscriptArtifact_workItemId_idx" ON "TranscriptArtifact"("workItemId");

-- CreateIndex
CREATE INDEX "TranscriptArtifact_capturedAt_idx" ON "TranscriptArtifact"("capturedAt");
