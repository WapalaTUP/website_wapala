CREATE TABLE "EventReplayFence" (
 "eventId" UUID NOT NULL REFERENCES "Event"("id") ON DELETE RESTRICT,
 "idempotencyKey" UUID NOT NULL, "ownerDigest" TEXT NOT NULL, "payloadDigest" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("eventId","idempotencyKey")
);
