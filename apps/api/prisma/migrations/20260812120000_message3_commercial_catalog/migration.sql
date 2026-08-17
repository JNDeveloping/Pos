-- Message 3: commercial catalog, price lists and audit trail.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TYPE "RoundingMode" RENAME VALUE 'TEN' TO 'MULTIPLE_10';
ALTER TYPE "RoundingMode" RENAME VALUE 'FIFTY' TO 'MULTIPLE_50';
ALTER TYPE "RoundingMode" RENAME VALUE 'HUNDRED' TO 'MULTIPLE_100';
ALTER TYPE "RoundingMode" ADD VALUE IF NOT EXISTS 'CUSTOM';
CREATE TYPE "BarcodeType" AS ENUM ('EAN13','EAN8','UPC','INTERNAL','CASE','OTHER');
CREATE TYPE "ChangeSource" AS ENUM ('MANUAL','IMPORT','BULK_UPDATE','COST_RECALCULATION','PURCHASE');
CREATE TYPE "PresentationType" AS ENUM ('UNIT','BOTTLE','CAN','PACKAGE','BOX','BAG','JAR','SACHET','PACK','TRAY','DISPLAY','CASE','OTHER');
CREATE TYPE "NetContentUnit" AS ENUM ('ML','L','G','KG','UN','M','CM','OTHER');

ALTER TABLE "Company" ADD COLUMN "productSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Branch" ADD COLUMN "latitude" DECIMAL(10,7), ADD COLUMN "longitude" DECIMAL(10,7),
  ADD COLUMN "roundingCustom" DECIMAL(10,2), ADD COLUMN "minimumMargin" DECIMAL(7,2) NOT NULL DEFAULT 0, ADD COLUMN "defaultPriceListId" UUID,
  ADD COLUMN "ticketLegalName" TEXT, ADD COLUMN "ticketCuit" TEXT, ADD COLUMN "ticketHeader" TEXT,
  ADD COLUMN "ticketShowBarcode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product" ADD COLUMN "subcategoryId" UUID, ADD COLUMN "supplierReference" TEXT,
  ADD COLUMN "presentationType" "PresentationType", ADD COLUMN "netContentUnit" "NetContentUnit",
  ADD COLUMN "allowManualPriceDefault" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "notes" TEXT;
UPDATE "Product" SET "supplierReference"="supplierCode", "allowManualPriceDefault"="allowManualPrice";
UPDATE "Product" SET "presentationType" = CASE "presentation"
  WHEN 'BOTELLA' THEN 'BOTTLE'::"PresentationType" WHEN 'LATA' THEN 'CAN'::"PresentationType"
  WHEN 'PAQUETE' THEN 'PACKAGE'::"PresentationType" WHEN 'CAJA' THEN 'BOX'::"PresentationType"
  WHEN 'BOLSA' THEN 'BAG'::"PresentationType" WHEN 'FRASCO' THEN 'JAR'::"PresentationType"
  WHEN 'SACHET' THEN 'SACHET'::"PresentationType" WHEN 'PACK' THEN 'PACK'::"PresentationType"
  WHEN 'UNIDAD' THEN 'UNIT'::"PresentationType" ELSE NULL END;
UPDATE "Product" SET "netContentUnit" = CASE UPPER(COALESCE("contentUnit",''))
  WHEN 'ML' THEN 'ML'::"NetContentUnit" WHEN 'L' THEN 'L'::"NetContentUnit" WHEN 'LITRO' THEN 'L'::"NetContentUnit"
  WHEN 'G' THEN 'G'::"NetContentUnit" WHEN 'GRAM' THEN 'G'::"NetContentUnit" WHEN 'KG' THEN 'KG'::"NetContentUnit"
  WHEN 'UN' THEN 'UN'::"NetContentUnit" WHEN 'M' THEN 'M'::"NetContentUnit" WHEN 'CM' THEN 'CM'::"NetContentUnit" ELSE NULL END;
ALTER TABLE "Product" DROP COLUMN "supplierCode", DROP COLUMN "presentation", DROP COLUMN "contentUnit", DROP COLUMN "allowManualPrice";
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_subcategoryId_idx" ON "Product"("subcategoryId");
CREATE INDEX "Product_companyId_shortName_idx" ON "Product"("companyId","shortName");
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_shortName_trgm_idx" ON "Product" USING GIN ("shortName" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);

ALTER TABLE "ProductBarcode" ADD COLUMN "type" "BarcodeType" NOT NULL DEFAULT 'OTHER';
CREATE INDEX "ProductBarcode_barcode_trgm_idx" ON "ProductBarcode" USING GIN ("barcode" gin_trgm_ops);
INSERT INTO "ProductBarcode" ("id","companyId","productId","barcode","type","isPrimary","updatedAt")
SELECT gen_random_uuid(), p."companyId", p.id, p."caseBarcode", 'CASE', false, CURRENT_TIMESTAMP FROM "Product" p
WHERE p."caseBarcode" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ProductBarcode" pb WHERE pb."companyId"=p."companyId" AND pb.barcode=p."caseBarcode");
ALTER TABLE "PriceHistory" ADD COLUMN "percentageChange" DECIMAL(9,2) NOT NULL DEFAULT 0, ADD COLUMN "source" "ChangeSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "CostHistory" ADD COLUMN "percentageChange" DECIMAL(9,2) NOT NULL DEFAULT 0, ADD COLUMN "source" "ChangeSource" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "PriceList" ("id" UUID NOT NULL,"companyId" UUID NOT NULL,"name" TEXT NOT NULL,"code" TEXT NOT NULL,"description" TEXT,"active" BOOLEAN NOT NULL DEFAULT true,"isDefault" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "PriceList_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "PriceList_companyId_code_key" ON "PriceList"("companyId","code");
CREATE INDEX "PriceList_companyId_active_idx" ON "PriceList"("companyId","active");
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "PriceList" ("id","companyId","name","code","description","active","isDefault","updatedAt")
SELECT gen_random_uuid(), id, 'Minorista', 'MINORISTA', 'Precio minorista predeterminado', true, true, CURRENT_TIMESTAMP FROM "Company";
UPDATE "Branch" b SET "defaultPriceListId"=pl.id FROM "PriceList" pl WHERE pl."companyId"=b."companyId" AND pl.code='MINORISTA';
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_defaultPriceListId_fkey" FOREIGN KEY ("defaultPriceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PriceListItem" ("id" UUID NOT NULL,"priceListId" UUID NOT NULL,"branchId" UUID NOT NULL,"productId" UUID NOT NULL,"price" DECIMAL(14,2) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "PriceListItem_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "PriceListItem_priceListId_branchId_productId_key" ON "PriceListItem"("priceListId","branchId","productId");
CREATE INDEX "PriceListItem_branchId_productId_idx" ON "PriceListItem"("branchId","productId");
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditLog" ("id" UUID NOT NULL,"companyId" UUID NOT NULL,"branchId" UUID,"userId" UUID NOT NULL,"entityType" TEXT NOT NULL,"entityId" UUID NOT NULL,"action" TEXT NOT NULL,"before" JSONB,"after" JSONB,"metadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "AuditLog_pkey" PRIMARY KEY("id"));
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId","createdAt");
CREATE INDEX "AuditLog_companyId_action_createdAt_idx" ON "AuditLog"("companyId","action","createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType","entityId","createdAt");
CREATE INDEX "AuditLog_branchId_createdAt_idx" ON "AuditLog"("branchId","createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
