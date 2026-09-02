-- AlterTable
ALTER TABLE "ServiceablePincode" ADD COLUMN     "district" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
