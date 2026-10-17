-- Tag registry: dikelola admin; isi tag konten tetap di ContentRecord.fields.tags
-- (Json) agar kompatibel dengan data import — registry hanya kosakata sah.
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- Backfill: tag dari data konten existing + kosakata bawaan (additive, aman).
INSERT INTO "Tag" ("id", "name", "slug", "createdAt")
SELECT gen_random_uuid(), names.value, replace(lower(names.value), ' ', '-'), CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT el.value AS value
    FROM "ContentRecord"
    CROSS JOIN LATERAL jsonb_array_elements_text("fields" -> 'tags') AS el(value)
    WHERE jsonb_typeof("fields" -> 'tags') = 'array'
    UNION
    SELECT value
    FROM (
        VALUES ('Gunung Hutan'), ('SAR'), ('Rock Climbing'), ('Rafting'), ('Caving'), ('Konservasi')
    ) AS defaults(value)
) AS names
ON CONFLICT DO NOTHING;
