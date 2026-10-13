-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('requested', 'approved', 'borrowed', 'awaiting_return', 'late', 'returned', 'rejected');

-- CreateTable
CREATE TABLE "Equipment" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "typeColor" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "yearEntered" TEXT NOT NULL DEFAULT '',
    "photo" TEXT NOT NULL DEFAULT '',
    "total" INTEGER NOT NULL,
    "fit" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "maxDays" INTEGER NOT NULL DEFAULT 7,
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "pic" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneDigest" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "collateral" TEXT NOT NULL,
    "collateralStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" "LoanStatus" NOT NULL DEFAULT 'requested',
    "notes" TEXT NOT NULL DEFAULT '',
    "originYear" INTEGER NOT NULL,
    "managementYear" INTEGER NOT NULL,
    "penalty" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "penaltyStatus" TEXT NOT NULL DEFAULT 'none',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanItem" (
    "id" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "requested" INTEGER NOT NULL,
    "approved" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "outCondition" TEXT NOT NULL DEFAULT 'Baik',
    "returnCondition" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "LoanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanHistory" (
    "id" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "status" "LoanStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_code_key" ON "Loan"("code");

-- CreateIndex
CREATE INDEX "Loan_status_start_end_idx" ON "Loan"("status", "start", "end");

-- CreateIndex
CREATE INDEX "Loan_managementYear_archivedAt_idx" ON "Loan"("managementYear", "archivedAt");

-- CreateIndex
CREATE INDEX "LoanItem_equipmentId_idx" ON "LoanItem"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanItem_loanId_equipmentId_key" ON "LoanItem"("loanId", "equipmentId");

-- CreateIndex
CREATE INDEX "LoanHistory_loanId_createdAt_idx" ON "LoanHistory"("loanId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanHistory" ADD CONSTRAINT "LoanHistory_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_quantities_valid" CHECK (total >= 0 AND fit >= 0 AND fit <= total AND "maxDays" BETWEEN 1 AND 365 AND "maxQuantity" > 0), ADD CONSTRAINT "Equipment_version_positive" CHECK (version > 0);
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_dates_valid" CHECK ("start" <= "end"), ADD CONSTRAINT "Loan_penalty_nonnegative" CHECK (penalty >= 0);
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_quantities_valid" CHECK (requested > 0 AND approved >= 0 AND approved <= requested);
