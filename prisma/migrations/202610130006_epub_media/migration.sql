ALTER TABLE "Media" DROP CONSTRAINT "Media_extension_check";
ALTER TABLE "Media" ADD CONSTRAINT "Media_extension_check" CHECK (extension IN ('webp', 'pdf', 'epub'));
