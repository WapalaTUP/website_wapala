-- Fingerprints only: expired environment setup tokens must not be reactivated.
ALTER TABLE "BootstrapState"
ADD COLUMN "environmentTokenHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
