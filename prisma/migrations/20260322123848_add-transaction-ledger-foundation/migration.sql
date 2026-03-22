-- CreateTable
CREATE TABLE "TransactionImportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDocumentId" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransactionImportSession_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ImportedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importSessionId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "taxYear" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "entryKind" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    CONSTRAINT "LedgerTransaction_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "TransactionImportSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LedgerTransaction_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ImportedDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransactionImportSession_sourceDocumentId_idx" ON "TransactionImportSession"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "TransactionImportSession_status_idx" ON "TransactionImportSession"("status");

-- CreateIndex
CREATE INDEX "TransactionImportSession_taxYear_idx" ON "TransactionImportSession"("taxYear");

-- CreateIndex
CREATE INDEX "LedgerTransaction_importSessionId_idx" ON "LedgerTransaction"("importSessionId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_sourceDocumentId_idx" ON "LedgerTransaction"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_taxYear_occurredAt_idx" ON "LedgerTransaction"("taxYear", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerTransaction_assetSymbol_occurredAt_idx" ON "LedgerTransaction"("assetSymbol", "occurredAt");
