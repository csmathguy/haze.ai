-- CreateTable
CREATE TABLE "KnowledgeSubject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "summary" TEXT,
    "profileJson" TEXT,
    "isPrimaryHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "subjectId" TEXT,
    "namespace" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "createdByKind" TEXT NOT NULL,
    "createdByName" TEXT,
    "tagsJson" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceUri" TEXT,
    "sourceChecksum" TEXT,
    "lastReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "KnowledgeSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSubject_slug_key" ON "KnowledgeSubject"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeSubject_kind_name_idx" ON "KnowledgeSubject"("kind", "name");

-- CreateIndex
CREATE INDEX "KnowledgeSubject_isPrimaryHuman_updatedAt_idx" ON "KnowledgeSubject"("isPrimaryHuman", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeSubject_namespace_idx" ON "KnowledgeSubject"("namespace");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_slug_key" ON "KnowledgeEntry"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_subjectId_updatedAt_idx" ON "KnowledgeEntry"("subjectId", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_kind_updatedAt_idx" ON "KnowledgeEntry"("kind", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_namespace_updatedAt_idx" ON "KnowledgeEntry"("namespace", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_status_updatedAt_idx" ON "KnowledgeEntry"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_visibility_updatedAt_idx" ON "KnowledgeEntry"("visibility", "updatedAt");
