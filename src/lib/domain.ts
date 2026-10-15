import type { LoanStatus, Module, Role } from "./types";
export const permissions: Record<Role, Module[]> = {
  "Super User": [
    "anggota",
    "konten",
    "galeri",
    "buku",
    "or",
    "inventaris",
    "peminjaman",
    "donasi",
    "pengguna",
    "pengaturan",
    "kepengurusan",
    "arsip",
    "audit",
  ],
  POH: ["anggota", "or"],
  Multimedia: ["konten", "galeri", "buku", "or", "donasi"],
  Inventaris: ["inventaris", "peminjaman", "or"],
};
export const canAccess = (role: Role, module: Module) =>
  permissions[role].includes(module);
export const canEdit = (role: Role, module: Module) =>
  canAccess(role, module) &&
  (module !== "or" || role === "Multimedia" || role === "Super User");
const transitions: Record<LoanStatus, LoanStatus[]> = {
  Diajukan: ["Disetujui", "Ditolak"],
  Ditolak: [],
  Disetujui: ["Dipinjam"],
  Dipinjam: ["Menunggu Verifikasi Pengembalian", "Terlambat"],
  Terlambat: ["Menunggu Verifikasi Pengembalian", "Dikembalikan"],
  "Menunggu Verifikasi Pengembalian": ["Dikembalikan"],
  Dikembalikan: [],
};
export const canTransition = (from: LoanStatus, to: LoanStatus) =>
  transitions[from].includes(to);
export function latePenalty(end: string, today: string) {
  const delta =
    (Date.parse(today + "T00:00:00Z") - Date.parse(end + "T00:00:00Z")) /
    86400000;
  return Math.max(0, Math.floor(delta)) * 2000;
}
export function validateDates(start: string, end: string) {
  if (!start || !end) return "Lengkapi tanggal pengambilan dan pengembalian.";
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)))
    return "Tanggal tidak valid.";
  if (end < start)
    return "Tanggal kembali tidak boleh sebelum tanggal pengambilan.";
  return "";
}
export const validPhone = (v: string) =>
  /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, ""));
export function uniqueCode(
  prefix: string,
  existing: string[],
  random = () => crypto.getRandomValues(new Uint32Array(1))[0],
) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 100; tries++) {
    let code = prefix;
    for (let i = 0; i < 5; i++) code += alphabet[random() % alphabet.length];
    if (!existing.some((v) => v.toUpperCase() === code)) return code;
  }
  throw new Error("Kode belum dapat dibuat. Coba kembali.");
}
export const normalizeCode = (code: string) => code.trim().toUpperCase();
export function uploadError(
  file: File,
  kind: "photo" | "proof" | "book" = "photo",
) {
  const allowed =
    kind === "book"
      ? ["application/pdf", "application/epub+zip"]
      : kind === "proof"
        ? ["image/jpeg", "image/png", "image/webp", "application/pdf"]
        : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type))
    return kind === "book"
      ? "Gunakan PDF atau EPUB."
      : "Gunakan JPG, PNG, WebP" + (kind === "proof" ? ", atau PDF." : ".");
  if (file.size > (kind === "book" ? 50 : 5) * 1024 * 1024)
    return `Ukuran maksimal ${kind === "book" ? 50 : 5} MB per berkas.`;
  return "";
}
