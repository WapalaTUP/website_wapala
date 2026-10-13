CREATE TABLE "Media" (
  "id" UUID PRIMARY KEY, "purpose" TEXT NOT NULL, "visibility" TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  "mime" TEXT NOT NULL, "extension" TEXT NOT NULL CHECK (extension IN ('webp', 'pdf')),
  "checksum" TEXT NOT NULL, "originalHash" TEXT NOT NULL, "size" INTEGER NOT NULL CHECK (size > 0),
  "width" INTEGER, "height" INTEGER, "ownerId" UUID, "ownerDigest" TEXT, "boundTo" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Media_public_images_only" CHECK (visibility <> 'public' OR mime = 'image/webp')
);
CREATE INDEX "Media_purpose_createdAt_idx" ON "Media" (purpose, "createdAt");
