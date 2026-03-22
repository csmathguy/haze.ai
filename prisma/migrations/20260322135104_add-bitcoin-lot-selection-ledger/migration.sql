-- CreateTable
CREATE TABLE "BitcoinLotSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxYear" INTEGER NOT NULL,
    "lotTransactionId" TEXT NOT NULL,
    "dispositionTransactionId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "selectionMethod" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BitcoinLotSelection_lotTransactionId_fkey" FOREIGN KEY ("lotTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BitcoinLotSelection_dispositionTransactionId_fkey" FOREIGN KEY ("dispositionTransactionId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BitcoinLotSelection_taxYear_dispositionTransactionId_idx" ON "BitcoinLotSelection"("taxYear", "dispositionTransactionId");

-- CreateIndex
CREATE INDEX "BitcoinLotSelection_lotTransactionId_idx" ON "BitcoinLotSelection"("lotTransactionId");
