-- Historical members may have unavailable NIM. NULL retains uniqueness for known NIMs.
ALTER TABLE "Member" ALTER COLUMN "nim" DROP NOT NULL;
