-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('waiting', 'verified', 'rejected');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" DECIMAL(16,0) NOT NULL,
    "collaborator" TEXT NOT NULL,
    "start" DATE,
    "end" DATE,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "cover" TEXT NOT NULL DEFAULT '',
    "poster" TEXT NOT NULL DEFAULT '',
    "qrisImage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBankAccount" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "bank" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CampaignBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(16,0) NOT NULL,
    "method" TEXT NOT NULL,
    "bankAccountId" UUID,
    "bankAccountLabel" TEXT,
    "proof" TEXT NOT NULL DEFAULT '',
    "status" "DonationStatus" NOT NULL DEFAULT 'waiting',
    "note" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignBankAccount_campaignId_bank_number_key" ON "CampaignBankAccount"("campaignId", "bank", "number");

-- CreateIndex
CREATE INDEX "Donation_campaignId_status_archivedAt_idx" ON "Donation"("campaignId", "status", "archivedAt");

-- AddForeignKey
ALTER TABLE "CampaignBankAccount" ADD CONSTRAINT "CampaignBankAccount_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_positive_target" CHECK (target > 0 AND target <= 1000000000000), ADD CONSTRAINT "Campaign_dates_ordered" CHECK ("start" IS NULL OR "end" IS NULL OR "start" <= "end"), ADD CONSTRAINT "Campaign_positive_version" CHECK (version > 0);
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_positive_amount" CHECK (amount > 0 AND amount <= 1000000000000);
