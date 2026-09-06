ALTER TYPE "RoundingMode" ADD VALUE IF NOT EXISTS 'MULTIPLE_500';
ALTER TYPE "RoundingMode" ADD VALUE IF NOT EXISTS 'MULTIPLE_1000';
ALTER TYPE "ChangeSource" ADD VALUE IF NOT EXISTS 'MOBILE';
ALTER TYPE "ChangeSource" ADD VALUE IF NOT EXISTS 'INVOICE';
ALTER TYPE "ChangeSource" ADD VALUE IF NOT EXISTS 'FAMILY_UPDATE';
ALTER TYPE "ChangeSource" ADD VALUE IF NOT EXISTS 'CATEGORY_UPDATE';

CREATE TYPE "RoundingDirection" AS ENUM ('UP', 'NEAREST');
CREATE TYPE "PriceUpdateMode" AS ENUM ('AUTO', 'SUGGEST', 'KEEP');
CREATE TYPE "PsychologicalEnding" AS ENUM ('NONE', 'END_00', 'END_50', 'END_90', 'END_99');

ALTER TABLE "Category" ADD COLUMN "targetMargin" DECIMAL(7,2), ADD COLUMN "roundingMode" "RoundingMode", ADD COLUMN "roundingCustom" DECIMAL(14,2), ADD COLUMN "roundingDirection" "RoundingDirection", ADD COLUMN "psychologicalEnding" "PsychologicalEnding", ADD COLUMN "priceUpdateMode" "PriceUpdateMode";
ALTER TABLE "ProductFamily" ADD COLUMN "targetMargin" DECIMAL(7,2), ADD COLUMN "roundingMode" "RoundingMode", ADD COLUMN "roundingCustom" DECIMAL(14,2), ADD COLUMN "roundingDirection" "RoundingDirection", ADD COLUMN "psychologicalEnding" "PsychologicalEnding", ADD COLUMN "priceUpdateMode" "PriceUpdateMode";
ALTER TABLE "Product" ADD COLUMN "targetMargin" DECIMAL(7,2), ADD COLUMN "roundingMode" "RoundingMode", ADD COLUMN "roundingCustom" DECIMAL(14,2), ADD COLUMN "roundingDirection" "RoundingDirection", ADD COLUMN "psychologicalEnding" "PsychologicalEnding", ADD COLUMN "priceUpdateMode" "PriceUpdateMode";
ALTER TABLE "BranchProduct" ADD COLUMN "targetMargin" DECIMAL(7,2), ADD COLUMN "calculatedPrice" DECIMAL(14,2), ADD COLUMN "automaticPricing" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "manualPrice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PriceHistory" ADD COLUMN "calculatedPrice" DECIMAL(14,2), ADD COLUMN "targetMargin" DECIMAL(7,2), ADD COLUMN "actualMargin" DECIMAL(9,2), ADD COLUMN "actualMarkup" DECIMAL(9,2), ADD COLUMN "roundingRule" TEXT;
ALTER TABLE "CostHistory" ADD COLUMN "supplierId" UUID;
