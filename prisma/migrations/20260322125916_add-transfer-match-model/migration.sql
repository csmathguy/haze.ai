-- CreateTable
CREATE TABLE "TransferMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outboundTransactionId" TEXT NOT NULL,
    "inboundTransactionId" TEXT,
    "taxYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferMatch_outboundTransactionId_fkey" FOREIGN KEY ("outboundTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferMatch_inboundTransactionId_fkey" FOREIGN KEY ("inboundTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TransferMatch_outboundTransactionId_idx" ON "TransferMatch"("outboundTransactionId");

-- CreateIndex
CREATE INDEX "TransferMatch_inboundTransactionId_idx" ON "TransferMatch"("inboundTransactionId");

-- CreateIndex
CREATE INDEX "TransferMatch_taxYear_status_idx" ON "TransferMatch"("taxYear", "status");
