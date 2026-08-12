-- Product remains the company-wide master catalog. BranchProduct is created only
-- when a branch explicitly enables the product.
ALTER TABLE "Product" ADD COLUMN "shortName" TEXT;

CREATE INDEX "BranchProduct_productId_enabled_idx" ON "BranchProduct"("productId", "enabled");
