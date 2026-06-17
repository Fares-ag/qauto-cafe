-- Office directory + department billing on orders
CREATE TYPE "BillingParty" AS ENUM ('INDIVIDUAL', 'DEPARTMENT');

ALTER TABLE "customers" ADD COLUMN "phone_extension" TEXT;

ALTER TABLE "orders" ADD COLUMN "billing_party" "BillingParty" NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE "orders" ADD COLUMN "guest_name" TEXT;

CREATE INDEX "customers_organization_id_phone_extension_idx" ON "customers"("organization_id", "phone_extension");
