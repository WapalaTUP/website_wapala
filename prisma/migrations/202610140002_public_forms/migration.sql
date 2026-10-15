CREATE TABLE "PublicFormReceipt" (
 "id" UUID NOT NULL, "kind" TEXT NOT NULL, "idempotencyKey" UUID NOT NULL,
 "ownerDigest" TEXT NOT NULL, "payloadDigest" TEXT NOT NULL, "response" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PublicFormReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicFormReceipt_kind_idempotencyKey_key" ON "PublicFormReceipt"("kind", "idempotencyKey");
CREATE INDEX "PublicFormReceipt_createdAt_idx" ON "PublicFormReceipt"("createdAt");
CREATE TABLE "ApplicantRevision" (
 "id" UUID NOT NULL, "applicantId" UUID NOT NULL, "number" INTEGER NOT NULL,
 "fields" JSONB NOT NULL, "photo" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ApplicantRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApplicantRevision_applicantId_number_key" ON "ApplicantRevision"("applicantId", "number");
ALTER TABLE "ApplicantRevision" ADD CONSTRAINT "ApplicantRevision_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
