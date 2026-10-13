CREATE TYPE "ContentKind" AS ENUM ('konten', 'galeri', 'buku');
CREATE TABLE "RecruitmentPeriod" (
  "year" INTEGER PRIMARY KEY CHECK (year BETWEEN 2004 AND 2200),
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "RecruitmentPeriod_one_active" ON "RecruitmentPeriod" (active) WHERE active = true;
CREATE TABLE "Applicant" (
  "id" UUID PRIMARY KEY, "code" TEXT NOT NULL, "year" INTEGER NOT NULL, "nim" TEXT NOT NULL,
  "phoneDigest" TEXT NOT NULL, "fields" JSONB NOT NULL, "photo" TEXT NOT NULL DEFAULT '',
  "revisions" INTEGER NOT NULL DEFAULT 0 CHECK (revisions >= 0), "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Applicant_year_fkey" FOREIGN KEY (year) REFERENCES "RecruitmentPeriod" (year) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Applicant_code_key" ON "Applicant" (code);
CREATE UNIQUE INDEX "Applicant_year_nim_key" ON "Applicant" (year, nim);
CREATE INDEX "Applicant_year_createdAt_idx" ON "Applicant" (year, "createdAt");
CREATE TABLE "Member" (
  "id" UUID PRIMARY KEY, "version" INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  "nia" TEXT NOT NULL, "nim" TEXT NOT NULL, "fields" JSONB NOT NULL,
  "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Member_nia_key" ON "Member" (nia);
CREATE UNIQUE INDEX "Member_nim_key" ON "Member" (nim);
CREATE TABLE "ContentRecord" (
  "id" UUID PRIMARY KEY, "kind" "ContentKind" NOT NULL, "version" INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  "fields" JSONB NOT NULL, "published" BOOLEAN NOT NULL DEFAULT false, "sourceId" TEXT,
  "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ContentRecord_kind_sourceId_key" ON "ContentRecord" (kind, "sourceId");
CREATE INDEX "ContentRecord_kind_published_archivedAt_idx" ON "ContentRecord" (kind, published, "archivedAt");
