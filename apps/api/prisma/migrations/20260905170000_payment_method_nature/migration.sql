CREATE TYPE "PaymentMethodKind" AS ENUM ('CASH', 'DEBIT', 'CREDIT', 'TRANSFER', 'QR', 'ACCOUNT', 'OTHER');

ALTER TABLE "PaymentMethod" ADD COLUMN "kind" "PaymentMethodKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Payment" ADD COLUMN "cashImpact" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "PaymentMethod" SET "kind" = CASE
  WHEN "code" = 'CASH' THEN 'CASH'::"PaymentMethodKind"
  WHEN "code" = 'DEBIT' THEN 'DEBIT'::"PaymentMethodKind"
  WHEN "code" = 'CREDIT' THEN 'CREDIT'::"PaymentMethodKind"
  WHEN "code" = 'TRANSFER' THEN 'TRANSFER'::"PaymentMethodKind"
  WHEN "code" IN ('QR', 'MERCADO_PAGO') THEN 'QR'::"PaymentMethodKind"
  WHEN "code" IN ('ACCOUNT', 'ACCOUNT_CURRENT') THEN 'ACCOUNT'::"PaymentMethodKind"
  ELSE 'OTHER'::"PaymentMethodKind"
END;

UPDATE "Payment" p SET "cashImpact" = p."amount"
FROM "PaymentMethod" m WHERE p."paymentMethodId" = m."id" AND m."kind" = 'CASH';
