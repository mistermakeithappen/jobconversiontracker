-- Drop the foreign key constraint
ALTER TABLE "prices" DROP CONSTRAINT "prices_product_id_fkey";

-- Alter the column types
ALTER TABLE "products" ALTER COLUMN "id" SET DATA TYPE TEXT;
ALTER TABLE "prices" ALTER COLUMN "product_id" SET DATA TYPE TEXT;

-- Re-add the foreign key constraint
ALTER TABLE "prices"
ADD CONSTRAINT "prices_product_id_fkey"
FOREIGN KEY ("product_id")
REFERENCES "products"("id");
