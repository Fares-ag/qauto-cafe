-- Office directory roster (staff with and without phone extensions)
ALTER TABLE "customers" ADD COLUMN "is_office_directory" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "customers_organization_id_is_office_directory_idx" ON "customers"("organization_id", "is_office_directory");

-- Existing extension entries were imported from the office directory
UPDATE "customers" SET "is_office_directory" = true WHERE "phone_extension" IS NOT NULL AND "deleted_at" IS NULL;
