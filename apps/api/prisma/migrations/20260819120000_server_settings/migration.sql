CREATE TABLE "CompanySetting" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"companyId" UUID NOT NULL,"key" TEXT NOT NULL,"value" JSONB NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CompanySetting_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "CompanySetting_companyId_key_key" ON "CompanySetting"("companyId","key");
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_companyId_fkey" FOREIGN KEY("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "BranchSetting" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"companyId" UUID NOT NULL,"branchId" UUID NOT NULL,"key" TEXT NOT NULL,"value" JSONB NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "BranchSetting_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "BranchSetting_branchId_key_key" ON "BranchSetting"("branchId","key"); CREATE INDEX "BranchSetting_companyId_key_idx" ON "BranchSetting"("companyId","key");
ALTER TABLE "BranchSetting" ADD CONSTRAINT "BranchSetting_companyId_fkey" FOREIGN KEY("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchSetting" ADD CONSTRAINT "BranchSetting_branchId_fkey" FOREIGN KEY("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
