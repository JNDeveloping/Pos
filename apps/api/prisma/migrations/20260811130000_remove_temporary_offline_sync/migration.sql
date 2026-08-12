-- The browser outbox/change-cursor implementation is intentionally retired.
-- Future offline support will synchronize branch-local PostgreSQL servers.
DROP TRIGGER IF EXISTS sync_company ON "Company";
DROP TRIGGER IF EXISTS sync_branch ON "Branch";
DROP TRIGGER IF EXISTS sync_category ON "Category";
DROP TRIGGER IF EXISTS sync_brand ON "Brand";
DROP TRIGGER IF EXISTS sync_product ON "Product";
DROP TRIGGER IF EXISTS sync_barcode ON "ProductBarcode";
DROP TRIGGER IF EXISTS sync_branch_product ON "BranchProduct";
DROP FUNCTION IF EXISTS record_sync_change();

DROP TABLE IF EXISTS "SyncOperation";
DROP TABLE IF EXISTS "SyncChange";
DROP TYPE IF EXISTS "SyncChangeOperation";
DROP TYPE IF EXISTS "SyncEntityType";
