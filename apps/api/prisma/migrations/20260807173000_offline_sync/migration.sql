-- CreateEnum
CREATE TYPE "SyncEntityType" AS ENUM ('COMPANY', 'BRANCH', 'CATEGORY', 'BRAND', 'PRODUCT', 'PRODUCT_BARCODE', 'BRANCH_PRODUCT');

-- CreateEnum
CREATE TYPE "SyncChangeOperation" AS ENUM ('UPSERT', 'DELETE');

-- CreateTable
CREATE TABLE "SyncChange" (
    "version" BIGSERIAL NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "entityType" "SyncEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "operation" "SyncChangeOperation" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncChange_companyId_version_idx" ON "SyncChange"("companyId", "version");

-- CreateIndex
CREATE INDEX "SyncChange_companyId_branchId_version_idx" ON "SyncChange"("companyId", "branchId", "version");

-- CreateIndex
CREATE INDEX "SyncChange_companyId_entityType_entityId_idx" ON "SyncChange"("companyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "SyncOperation_companyId_deviceId_createdAt_idx" ON "SyncOperation"("companyId", "deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_companyId_operationId_key" ON "SyncOperation"("companyId", "operationId");

-- AddForeignKey
ALTER TABLE "SyncChange" ADD CONSTRAINT "SyncChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Every synchronized catalog mutation produces a monotonic cursor. Keeping this
-- in PostgreSQL guarantees changes are captured regardless of which API path writes.
CREATE OR REPLACE FUNCTION record_sync_change() RETURNS trigger AS $$
DECLARE
  row_data jsonb;
  resolved_company uuid;
  resolved_branch uuid;
  resolved_entity uuid;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  resolved_entity := (row_data->>'id')::uuid;

  IF TG_TABLE_NAME = 'Company' THEN
    resolved_company := resolved_entity;
  ELSIF TG_TABLE_NAME IN ('Branch', 'Category', 'Brand', 'Product') THEN
    resolved_company := (row_data->>'companyId')::uuid;
  ELSIF TG_TABLE_NAME = 'ProductBarcode' THEN
    SELECT "companyId" INTO resolved_company FROM "Product" WHERE id = (row_data->>'productId')::uuid;
  ELSIF TG_TABLE_NAME = 'BranchProduct' THEN
    SELECT "companyId" INTO resolved_company FROM "Branch" WHERE id = (row_data->>'branchId')::uuid;
    resolved_branch := (row_data->>'branchId')::uuid;
  END IF;

  IF TG_TABLE_NAME = 'Branch' THEN resolved_branch := resolved_entity; END IF;

  INSERT INTO "SyncChange" ("companyId", "branchId", "entityType", "entityId", operation, payload)
  VALUES (
    resolved_company,
    resolved_branch,
    TG_ARGV[0]::"SyncEntityType",
    resolved_entity,
    CASE WHEN TG_OP = 'DELETE' OR row_data->>'deletedAt' IS NOT NULL OR row_data->>'active' = 'false'
      THEN 'DELETE'::"SyncChangeOperation" ELSE 'UPSERT'::"SyncChangeOperation" END,
    row_data
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_company AFTER INSERT OR UPDATE OR DELETE ON "Company" FOR EACH ROW EXECUTE FUNCTION record_sync_change('COMPANY');
CREATE TRIGGER sync_branch AFTER INSERT OR UPDATE OR DELETE ON "Branch" FOR EACH ROW EXECUTE FUNCTION record_sync_change('BRANCH');
CREATE TRIGGER sync_category AFTER INSERT OR UPDATE OR DELETE ON "Category" FOR EACH ROW EXECUTE FUNCTION record_sync_change('CATEGORY');
CREATE TRIGGER sync_brand AFTER INSERT OR UPDATE OR DELETE ON "Brand" FOR EACH ROW EXECUTE FUNCTION record_sync_change('BRAND');
CREATE TRIGGER sync_product AFTER INSERT OR UPDATE OR DELETE ON "Product" FOR EACH ROW EXECUTE FUNCTION record_sync_change('PRODUCT');
CREATE TRIGGER sync_barcode AFTER INSERT OR UPDATE OR DELETE ON "ProductBarcode" FOR EACH ROW EXECUTE FUNCTION record_sync_change('PRODUCT_BARCODE');
CREATE TRIGGER sync_branch_product AFTER INSERT OR UPDATE OR DELETE ON "BranchProduct" FOR EACH ROW EXECUTE FUNCTION record_sync_change('BRANCH_PRODUCT');

-- Existing installations receive a deterministic baseline without rerunning seeds.
INSERT INTO "SyncChange" ("companyId", "entityType", "entityId", operation, payload)
SELECT id, 'COMPANY', id, 'UPSERT', to_jsonb(c) FROM "Company" c WHERE active;
INSERT INTO "SyncChange" ("companyId", "branchId", "entityType", "entityId", operation, payload)
SELECT "companyId", id, 'BRANCH', id, CASE WHEN active AND "deletedAt" IS NULL THEN 'UPSERT'::"SyncChangeOperation" ELSE 'DELETE'::"SyncChangeOperation" END, to_jsonb(b) FROM "Branch" b;
INSERT INTO "SyncChange" ("companyId", "entityType", "entityId", operation, payload)
SELECT "companyId", 'CATEGORY', id, CASE WHEN active AND "deletedAt" IS NULL THEN 'UPSERT'::"SyncChangeOperation" ELSE 'DELETE'::"SyncChangeOperation" END, to_jsonb(c) FROM "Category" c;
INSERT INTO "SyncChange" ("companyId", "entityType", "entityId", operation, payload)
SELECT "companyId", 'BRAND', id, CASE WHEN active AND "deletedAt" IS NULL THEN 'UPSERT'::"SyncChangeOperation" ELSE 'DELETE'::"SyncChangeOperation" END, to_jsonb(b) FROM "Brand" b;
INSERT INTO "SyncChange" ("companyId", "entityType", "entityId", operation, payload)
SELECT "companyId", 'PRODUCT', id, CASE WHEN active AND "deletedAt" IS NULL THEN 'UPSERT'::"SyncChangeOperation" ELSE 'DELETE'::"SyncChangeOperation" END, to_jsonb(p) FROM "Product" p;
INSERT INTO "SyncChange" ("companyId", "entityType", "entityId", operation, payload)
SELECT p."companyId", 'PRODUCT_BARCODE', pb.id, 'UPSERT', to_jsonb(pb) FROM "ProductBarcode" pb JOIN "Product" p ON p.id = pb."productId";
INSERT INTO "SyncChange" ("companyId", "branchId", "entityType", "entityId", operation, payload)
SELECT b."companyId", bp."branchId", 'BRANCH_PRODUCT', bp.id, 'UPSERT', to_jsonb(bp) FROM "BranchProduct" bp JOIN "Branch" b ON b.id = bp."branchId";
