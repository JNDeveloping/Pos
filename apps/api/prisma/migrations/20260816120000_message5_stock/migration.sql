-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_RECEIPT', 'SALE', 'SALE_RETURN', 'MANUAL_INCREASE', 'MANUAL_DECREASE', 'INVENTORY_ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'WASTE', 'BREAKAGE', 'EXPIRATION', 'INTERNAL_CONSUMPTION', 'INITIAL_STOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('FULL', 'CATEGORY', 'SELECTED_PRODUCTS', 'SECTOR');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('BREAKAGE', 'EXPIRATION', 'THEFT', 'INTERNAL_CONSUMPTION', 'DAMAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'REQUESTED', 'PREPARING', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expirationAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trackLots" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Stock" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reservedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "inTransitQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "previousQuantity" DECIMAL(14,3) NOT NULL,
    "newQuantity" DECIMAL(14,3) NOT NULL,
    "referenceType" TEXT,
    "referenceId" UUID,
    "reason" TEXT,
    "userId" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLot" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "lotNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "quantity" DECIMAL(14,3) NOT NULL,
    "purchaseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryType" NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" UUID,
    "sector" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "confirmedByUserId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "systemQuantity" DECIMAL(14,3) NOT NULL,
    "countedQuantity" DECIMAL(14,3),
    "difference" DECIMAL(14,3),
    "countedByUserId" UUID,
    "countedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waste" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "WasteType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCostSnapshot" DECIMAL(14,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "fromBranchId" UUID NOT NULL,
    "toBranchId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "sentByUserId" UUID,
    "receivedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "requestedQuantity" DECIMAL(14,3) NOT NULL,
    "sentQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "receivedQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stock_companyId_branchId_idx" ON "Stock"("companyId", "branchId");

-- CreateIndex
CREATE INDEX "Stock_productId_idx" ON "Stock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_branchId_productId_key" ON "Stock"("branchId", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_productId_createdAt_idx" ON "StockMovement"("branchId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_type_createdAt_idx" ON "StockMovement"("companyId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_companyId_referenceType_referenceId_productId_key" ON "StockMovement"("companyId", "referenceType", "referenceId", "productId", "type");

-- CreateIndex
CREATE INDEX "StockLot_branchId_productId_idx" ON "StockLot"("branchId", "productId");

-- CreateIndex
CREATE INDEX "StockLot_expirationDate_idx" ON "StockLot"("expirationDate");

-- CreateIndex
CREATE INDEX "Inventory_companyId_branchId_status_idx" ON "Inventory"("companyId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_inventoryId_productId_key" ON "InventoryItem"("inventoryId", "productId");

-- CreateIndex
CREATE INDEX "Waste_companyId_branchId_createdAt_idx" ON "Waste"("companyId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Waste_productId_idx" ON "Waste"("productId");

-- CreateIndex
CREATE INDEX "StockTransfer_companyId_status_createdAt_idx" ON "StockTransfer"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_companyId_number_key" ON "StockTransfer"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferItem_transferId_productId_key" ON "StockTransferItem"("transferId", "productId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

