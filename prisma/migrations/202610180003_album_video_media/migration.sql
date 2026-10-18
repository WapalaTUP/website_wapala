-- Expand accepted media formats without rewriting or deleting existing rows.
-- Keep existing constraint names; older releases can still store/read their media.
ALTER TABLE "Media"
  DROP CONSTRAINT "Media_extension_check",
  ADD CONSTRAINT "Media_extension_check"
    CHECK (extension IN ('webp', 'pdf', 'epub', 'mp4')),
  DROP CONSTRAINT "Media_public_images_only",
  ADD CONSTRAINT "Media_public_images_only"
    CHECK (
      visibility <> 'public'
      OR mime = 'image/webp'
      OR (purpose = 'content-video' AND mime = 'video/mp4' AND extension = 'mp4')
    );
