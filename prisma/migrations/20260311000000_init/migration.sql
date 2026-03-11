-- CreateTable
CREATE TABLE "HouseholdProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taxYear" INTEGER NOT NULL,
    "filingStatus" TEXT NOT NULL,
    "hasDigitalAssets" BOOLEAN NOT NULL DEFAULT false,
    "primaryTaxpayer" TEXT NOT NULL,
    "stateResidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImportedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "importedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MissingFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    CONSTRAINT "MissingFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ImportedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountName" TEXT NOT NULL,
    "acquiredOn" TEXT NOT NULL,
    "assetKind" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "costBasisInCents" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "holdingTerm" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    CONSTRAINT "AssetLot_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ImportedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportedDocument_importedAt_idx" ON "ImportedDocument"("importedAt");

-- CreateIndex
CREATE INDEX "ImportedDocument_taxYear_idx" ON "ImportedDocument"("taxYear");

-- CreateIndex
CREATE INDEX "MissingFact_documentId_idx" ON "MissingFact"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "MissingFact_documentId_sequence_key" ON "MissingFact"("documentId", "sequence");

-- CreateIndex
CREATE INDEX "AssetLot_assetKey_acquiredOn_idx" ON "AssetLot"("assetKey", "acquiredOn");

-- CreateIndex
CREATE INDEX "AssetLot_sourceDocumentId_idx" ON "AssetLot"("sourceDocumentId");
