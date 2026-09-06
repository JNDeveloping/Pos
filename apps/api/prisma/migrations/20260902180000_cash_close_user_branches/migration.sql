ALTER TABLE "CashSession"
  ADD COLUMN "closingAmount" DECIMAL(14,2),
  ADD COLUMN "closingNote" TEXT,
  ADD COLUMN "closedByUserId" UUID;

ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserBranchAccess" (
  "userId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBranchAccess_pkey" PRIMARY KEY ("userId", "branchId")
);
CREATE INDEX "UserBranchAccess_companyId_branchId_idx" ON "UserBranchAccess"("companyId", "branchId");
ALTER TABLE "UserBranchAccess" ADD CONSTRAINT "UserBranchAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranchAccess" ADD CONSTRAINT "UserBranchAccess_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBranchAccess" ADD CONSTRAINT "UserBranchAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve current operation: assigned users keep their branch; company-wide users receive every active branch.
INSERT INTO "UserBranchAccess" ("userId", "branchId", "companyId")
SELECT u."id", b."id", u."companyId"
FROM "User" u
JOIN "Branch" b ON b."companyId" = u."companyId" AND b."deletedAt" IS NULL
WHERE (u."branchId" IS NULL OR b."id" = u."branchId") AND u."deletedAt" IS NULL
ON CONFLICT ("userId", "branchId") DO NOTHING;

INSERT INTO "Permission" ("id", "companyId", "code", "module", "label", "description", "sortOrder", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."id", p.code, 'SALES', p.label, p.label, p.sort_order, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c CROSS JOIN (VALUES
  ('cashSessions.open', 'Dar de alta / abrir caja', 901),
  ('cashSessions.close', 'Dar de baja / cerrar caja', 902)
) AS p(code, label, sort_order)
ON CONFLICT ("companyId", "code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT DISTINCT rp."roleId", target."id"
FROM "RolePermission" rp
JOIN "Permission" existing ON existing."id" = rp."permissionId" AND existing."code" = 'sales.access'
JOIN "Role" role ON role."id" = rp."roleId"
JOIN "Permission" target ON target."companyId" = role."companyId" AND target."code" IN ('cashSessions.open', 'cashSessions.close')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
