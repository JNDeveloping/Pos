CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "StockLocationType" AS ENUM ('SALE_FLOOR', 'WAREHOUSE');
CREATE TABLE "StockLocationBalance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "branchId" UUID NOT NULL,
  "productId" UUID NOT NULL, "location" "StockLocationType" NOT NULL, "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StockLocationBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockLocationBalance_branchId_productId_location_key" ON "StockLocationBalance"("branchId", "productId", "location");
CREATE INDEX "StockLocationBalance_companyId_branchId_location_idx" ON "StockLocationBalance"("companyId", "branchId", "location");
CREATE INDEX "StockLocationBalance_productId_idx" ON "StockLocationBalance"("productId");
INSERT INTO "StockLocationBalance" ("id", "companyId", "branchId", "productId", "location", "quantity", "updatedAt")
SELECT gen_random_uuid(), "companyId", "branchId", "productId", 'SALE_FLOOR', "quantity", CURRENT_TIMESTAMP FROM "Stock";
CREATE TABLE "CashSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "branchId" UUID NOT NULL,
  "terminalId" UUID NOT NULL, "cashierUserId" UUID NOT NULL, "openedByUserId" UUID NOT NULL,
  "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN', "openingAmount" DECIMAL(14,2) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" TIMESTAMP(3),
  CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashSession_companyId_branchId_status_idx" ON "CashSession"("companyId", "branchId", "status");
CREATE INDEX "CashSession_terminalId_status_idx" ON "CashSession"("terminalId", "status");
CREATE INDEX "CashSession_cashierUserId_status_idx" ON "CashSession"("cashierUserId", "status");
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD COLUMN "cashSessionId" UUID;
CREATE INDEX "Sale_cashSessionId_idx" ON "Sale"("cashSessionId");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PosQuickGroup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "branchId" UUID NOT NULL,
  "name" TEXT NOT NULL, "icon" TEXT NOT NULL DEFAULT '◉', "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "buttonSize" TEXT NOT NULL DEFAULT 'MEDIUM', "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PosQuickGroup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PosQuickGroupItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "groupId" UUID NOT NULL, "productId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "PosQuickGroupItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PosQuickGroup_companyId_branchId_active_sortOrder_idx" ON "PosQuickGroup"("companyId", "branchId", "active", "sortOrder");
CREATE UNIQUE INDEX "PosQuickGroupItem_groupId_productId_key" ON "PosQuickGroupItem"("groupId", "productId");
CREATE INDEX "PosQuickGroupItem_productId_idx" ON "PosQuickGroupItem"("productId");
ALTER TABLE "PosQuickGroupItem" ADD CONSTRAINT "PosQuickGroupItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PosQuickGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosQuickGroupItem" ADD CONSTRAINT "PosQuickGroupItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
