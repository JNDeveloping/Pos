CREATE TYPE "CashMovementKind" AS ENUM ('INCOME', 'EXPENSE', 'WITHDRAWAL');

CREATE TABLE "CashMovement" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "cashSessionId" UUID NOT NULL,
  "kind" "CashMovementKind" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'POS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");
CREATE INDEX "CashMovement_companyId_branchId_createdAt_idx" ON "CashMovement"("companyId", "branchId", "createdAt");
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La validación deja de depender de una carrera entre findFirst y create.
CREATE UNIQUE INDEX "CashSession_one_open_per_terminal_idx"
  ON "CashSession"("terminalId") WHERE "status" = 'OPEN';
