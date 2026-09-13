CREATE TYPE "SuspendedSaleStatus" AS ENUM ('PENDING', 'RECOVERED', 'CANCELLED');

CREATE TABLE "SuspendedSale" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "terminalId" UUID NOT NULL,
    "cashSessionId" UUID NOT NULL,
    "suspendedByUserId" UUID NOT NULL,
    "status" "SuspendedSaleStatus" NOT NULL DEFAULT 'PENDING',
    "cartSnapshot" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "suspendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMP(3),
    "recoveredByUserId" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" UUID,
    CONSTRAINT "SuspendedSale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SuspendedSale_companyId_branchId_status_suspendedAt_idx"
ON "SuspendedSale"("companyId", "branchId", "status", "suspendedAt");
CREATE INDEX "SuspendedSale_cashSessionId_status_idx" ON "SuspendedSale"("cashSessionId", "status");
CREATE INDEX "SuspendedSale_terminalId_status_idx" ON "SuspendedSale"("terminalId", "status");

ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_terminalId_fkey"
FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_cashSessionId_fkey"
FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_suspendedByUserId_fkey"
FOREIGN KEY ("suspendedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_recoveredByUserId_fkey"
FOREIGN KEY ("recoveredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SuspendedSale" ADD CONSTRAINT "SuspendedSale_cancelledByUserId_fkey"
FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
