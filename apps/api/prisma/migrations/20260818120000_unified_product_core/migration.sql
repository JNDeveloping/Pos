CREATE TABLE "ProductFamily" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductFamily_companyId_name_key" ON "ProductFamily"("companyId", "name");
CREATE INDEX "ProductFamily_companyId_active_name_idx" ON "ProductFamily"("companyId", "active", "name");
ALTER TABLE "ProductFamily" ADD CONSTRAINT "ProductFamily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD COLUMN "familyId" UUID;
CREATE INDEX "Product_familyId_idx" ON "Product"("familyId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierProduct" ADD COLUMN "minimumOrderQuantity" DECIMAL(14,3), ADD COLUMN "preferredSupplier" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "SupplierProduct_productId_supplierCode_idx" ON "SupplierProduct"("productId", "supplierCode");
