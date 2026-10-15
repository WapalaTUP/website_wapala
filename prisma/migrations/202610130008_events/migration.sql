CREATE TABLE "Event" (
 "id" UUID PRIMARY KEY, "version" INTEGER NOT NULL DEFAULT 1,
 "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','active','closed','archived')),
 "draft" JSONB NOT NULL, "publishedRevisionId" UUID,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "EventFormRevision" (
 "id" UUID PRIMARY KEY, "eventId" UUID NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
 "number" INTEGER NOT NULL, "snapshot" JSONB NOT NULL, "createdBy" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("eventId","number"), UNIQUE ("id","eventId")
);
ALTER TABLE "Event" ADD CONSTRAINT "Event_published_revision_fkey" FOREIGN KEY ("publishedRevisionId","id") REFERENCES "EventFormRevision"("id","eventId") ON DELETE RESTRICT;
CREATE TABLE "EventRegistration" (
 "id" UUID PRIMARY KEY, "code" TEXT NOT NULL UNIQUE,
 "eventId" UUID NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
 "revisionId" UUID NOT NULL, "idempotencyKey" UUID NOT NULL, "ownerDigest" TEXT NOT NULL,
 "payloadDigest" TEXT NOT NULL, "answers" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("revisionId","eventId") REFERENCES "EventFormRevision"("id","eventId") ON DELETE RESTRICT,
 UNIQUE ("eventId","idempotencyKey")
);
CREATE INDEX "EventRegistration_eventId_createdAt_idx" ON "EventRegistration"("eventId","createdAt");
