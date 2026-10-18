-- Additive: preserve the member JSON shape read by older releases.
ALTER TABLE "Member" ADD COLUMN "angkatanWapala" TEXT NOT NULL DEFAULT '';
