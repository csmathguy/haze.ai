-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "extractorKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parsedAt" DATETIME,
    CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ImportedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extractionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "confidence" TEXT NOT NULL,
    "taxRelevance" TEXT NOT NULL,
    "isMissing" BOOLEAN NOT NULL DEFAULT false,
    "sourcePage" INTEGER,
    "provenanceHint" TEXT,
    CONSTRAINT "ExtractedField_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "DocumentExtraction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ImportedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataGap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT,
    "extractedFieldId" TEXT,
    "gapKind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataGap_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ImportedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DataGap_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "ExtractedField" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptKey" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceDocumentId" TEXT,
    "sourceGapId" TEXT,
    CONSTRAINT "QuestionnaireResponse_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ImportedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestionnaireResponse_sourceGapId_fkey" FOREIGN KEY ("sourceGapId") REFERENCES "DataGap" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentExtraction_documentId_idx" ON "DocumentExtraction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_status_idx" ON "DocumentExtraction"("status");

-- CreateIndex
CREATE INDEX "ExtractedField_documentId_idx" ON "ExtractedField"("documentId");

-- CreateIndex
CREATE INDEX "ExtractedField_extractionId_idx" ON "ExtractedField"("extractionId");

-- CreateIndex
CREATE INDEX "DataGap_documentId_idx" ON "DataGap"("documentId");

-- CreateIndex
CREATE INDEX "DataGap_extractedFieldId_idx" ON "DataGap"("extractedFieldId");

-- CreateIndex
CREATE INDEX "DataGap_status_idx" ON "DataGap"("status");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_promptKey_taxYear_idx" ON "QuestionnaireResponse"("promptKey", "taxYear");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_sourceDocumentId_idx" ON "QuestionnaireResponse"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_sourceGapId_idx" ON "QuestionnaireResponse"("sourceGapId");
