-- Shiprocket shipping integration: additive, nullable columns on "Shipment".
-- No enum changes, no data backfill, fully backward compatible.

ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "rawStatus" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "invoiceUrl" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "providerShipmentId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "courierId" INTEGER;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "pickupLocation" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "pickupScheduledAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "pickupTokenNumber" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "freightCharge" DECIMAL(12,2);
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "appliedWeightGrams" INTEGER;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Shipment_providerShipmentId_idx" ON "Shipment"("providerShipmentId");
