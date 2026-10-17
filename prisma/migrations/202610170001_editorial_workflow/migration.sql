ALTER TABLE "ContentRecord"
  ADD COLUMN "authorId" UUID,
  ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "reviewNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "draftFields" JSONB,
  ADD COLUMN "contentMeta" JSONB NOT NULL DEFAULT '{}';
UPDATE "ContentRecord" SET "workflowStatus" = 'published' WHERE "published" = true;
CREATE INDEX "ContentRecord_authorId_workflowStatus_idx" ON "ContentRecord"("authorId", "workflowStatus");
