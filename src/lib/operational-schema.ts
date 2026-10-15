import { z } from "zod";
const text = z.string().trim().max(300),
  optional = text.optional().default("");
const media = z
  .union([z.literal(""), z.string().regex(/^\/api\/media\/[a-f0-9-]{36}$/)])
  .optional()
  .default("");
export const memberFields = z
  .object({
    nomor: optional,
    nama: text.min(1),
    nim: text.max(40),
    prodi: text.min(1),
    angkatan: text.min(1),
    jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]),
    nia: text.min(1).max(60),
    status: z.enum(["Aktif", "AB", "AM", "ALB", "AK"]),
    kontak: text,
    foto: media,
  })
  .strict();
export const conditionSchema = z.enum([
  "Baik",
  "Kotor",
  "Rusak Ringan",
  "Rusak Berat",
  "Hilang",
]);
export const inventoryConditionSchema = z.enum([
  "Baik",
  "Kotor",
  "Rusak Ringan",
  "Rusak Berat",
  "Hilang",
  "Rusak",
  "Sebagian rusak",
]);
export function initialReturnCondition(value: string) {
  return conditionSchema.safeParse(value).success ? value : "";
}
export const equipmentSchema = z
  .object({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    code: text.min(1).max(60),
    name: text.min(1),
    category: text.min(1),
    brand: optional,
    typeColor: optional,
    source: optional,
    yearEntered: z
      .string()
      .trim()
      .transform((value) => value.replace(/^((?:19|20|21)\d{2})\.0+$/, "$1"))
      .pipe(z.union([z.literal(""), z.string().regex(/^(19|20|21)\d{2}$/)]))
      .optional()
      .default(""),
    photo: media,
    total: z.number().int().min(0).max(100000),
    fit: z.number().int().min(0).max(100000),
    condition: inventoryConditionSchema,
    location: text.min(1),
    available: z.boolean(),
    maxDays: z.number().int().min(1).max(365),
    maxQuantity: z.number().int().min(1).max(100000),
    notes: z.string().trim().max(2000),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.fit <= v.total, {
    message: "Jumlah layak tidak boleh melebihi jumlah total.",
    path: ["fit"],
  });
