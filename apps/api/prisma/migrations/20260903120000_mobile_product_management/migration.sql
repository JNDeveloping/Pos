CREATE TYPE "LabelQueueStatus" AS ENUM ('PENDING', 'PRINTED');

CREATE TABLE "LabelPrintQueue" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "oldPrice" DECIMAL(14,2) NOT NULL,
  "newPrice" DECIMAL(14,2) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "status" "LabelQueueStatus" NOT NULL DEFAULT 'PENDING',
  "printedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabelPrintQueue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LabelPrintQueue_companyId_branchId_status_createdAt_idx" ON "LabelPrintQueue"("companyId", "branchId", "status", "createdAt");
CREATE INDEX "LabelPrintQueue_productId_createdAt_idx" ON "LabelPrintQueue"("productId", "createdAt");
ALTER TABLE "LabelPrintQueue" ADD CONSTRAINT "LabelPrintQueue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabelPrintQueue" ADD CONSTRAINT "LabelPrintQueue_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabelPrintQueue" ADD CONSTRAINT "LabelPrintQueue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabelPrintQueue" ADD CONSTRAINT "LabelPrintQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
