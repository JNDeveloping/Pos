CREATE TABLE "PosLiveEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "terminalId" UUID NOT NULL,
  "cashSessionId" UUID,
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosLiveEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosLiveEvent_companyId_branchId_createdAt_idx" ON "PosLiveEvent"("companyId", "branchId", "createdAt");
CREATE INDEX "PosLiveEvent_terminalId_createdAt_idx" ON "PosLiveEvent"("terminalId", "createdAt");
CREATE INDEX "PosLiveEvent_cashSessionId_createdAt_idx" ON "PosLiveEvent"("cashSessionId", "createdAt");
