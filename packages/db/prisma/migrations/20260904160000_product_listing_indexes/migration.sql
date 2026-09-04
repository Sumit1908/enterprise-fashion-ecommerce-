-- Performance: index the exact filter/sort combinations the storefront uses
-- on every listing, facets and PDP query. Additive only, no data change.
-- The catalog is small right now so this applies instantly; it matters as the
-- real product catalog grows.

CREATE INDEX IF NOT EXISTS "Product_status_deletedAt_publishedAt_idx"
  ON "Product"("status", "deletedAt", "publishedAt");

CREATE INDEX IF NOT EXISTS "Product_salePrice_idx"
  ON "Product"("salePrice");
