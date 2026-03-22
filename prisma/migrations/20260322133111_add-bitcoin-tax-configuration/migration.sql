-- CreateTable
CREATE TABLE "BitcoinTaxConfiguration" (
    "taxYear" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assetSymbol" TEXT NOT NULL DEFAULT 'BTC',
    "transitionMethod" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
