-- Las ventas rápidas conservan snapshots contables sin inventar un producto ni afectar stock.
ALTER TABLE "SaleItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "SaleItem" ALTER COLUMN "branchProductId" DROP NOT NULL;
ALTER TABLE "SaleReturnItem" ALTER COLUMN "productId" DROP NOT NULL;
