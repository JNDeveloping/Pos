ALTER TABLE "Branch"
  ADD COLUMN "whatsapp" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "businessHours" TEXT,
  ADD COLUMN "defaultMargin" DECIMAL(7,2) NOT NULL DEFAULT 30,
  ADD COLUMN "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
  ADD COLUMN "roundingMode" "RoundingMode" NOT NULL DEFAULT 'TEN',
  ADD COLUMN "allowDiscounts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxDiscount" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "allowManualPrice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireCashOpen" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoPrintTicket" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ticketWidth" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ticketTradeName" TEXT,
  ADD COLUMN "ticketAddress" TEXT,
  ADD COLUMN "ticketPhone" TEXT,
  ADD COLUMN "ticketFooter" TEXT,
  ADD COLUMN "ticketShowCuit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ticketShowCashier" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ticketShowSaleCode" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Product"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "supplierCode" TEXT,
  ADD COLUMN "presentation" TEXT,
  ADD COLUMN "netContent" DECIMAL(12,3),
  ADD COLUMN "contentUnit" TEXT,
  ADD COLUMN "unitsPerCase" INTEGER,
  ADD COLUMN "caseBarcode" TEXT,
  ADD COLUMN "isWeighted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowManualPrice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BranchProduct"
  ADD COLUMN "posFavorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowManualPrice" BOOLEAN,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "shelf" TEXT,
  ADD COLUMN "internalNotes" TEXT;

CREATE INDEX "Product_companyId_sku_idx" ON "Product"("companyId", "sku");
CREATE INDEX "Product_companyId_caseBarcode_idx" ON "Product"("companyId", "caseBarcode");
