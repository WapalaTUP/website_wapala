import type { Applicant } from "./types";
import { date } from "./content";
// Field labels only, verified against the supplied Oprec XLSX/PDF. No participant rows imported.
export const orPersonal = [
  ["nama", "Nama Lengkap"],
  ["tempat_lahir", "Tempat lahir"],
  ["tanggal_lahir", "Tanggal lahir"],
  ["jenis_kelamin", "Jenis Kelamin"],
  ["golongan_darah", "Golongan Darah"],
  ["agama", "Agama"],
];
export const orAcademic = [
  ["nim", "NIM"],
  ["prodi", "Program Studi"],
  ["email", "Email"],
  ["telepon", "No Handphone"],
  ["alamat_rumah", "Alamat Rumah"],
  ["alamat_domisili", "Alamat Domisili"],
];
const orLabels: Record<string, string> = Object.fromEntries([
  ...orPersonal,
  ...orAcademic,
  ["nama_orangtua", "Nama Orang Tua"],
  ["telepon_orangtua", "No Handphone Orang Tua"],
  ["motivasi", "Motivasi"],
  ["pengalaman_organisasi", "Pengalaman Organisasi"],
  ["riwayat_penyakit", "Riwayat Penyakit"],
]);
export const orFieldLabel = (key: string) => orLabels[key] || key.replaceAll("_", " ");
export function applicantExportRow(a: Applicant, index: number): Record<string, string | number> {
  const f = a.fields;
  return {
    No: index + 1,
    "Nama Lengkap": f.nama || "",
    "Jenis Kelamin": f.jenis_kelamin || "",
    "Tempat Tanggal Lahir": [f.tempat_lahir, f.tanggal_lahir ? date(f.tanggal_lahir) : ""]
      .filter(Boolean)
      .join(", "),
    NIM: f.nim || "",
    "Program Studi": f.prodi || "",
    Agama: f.agama || "",
    "No Handphone": f.telepon || "",
    Email: f.email || "",
    "Alamat Rumah": f.alamat_rumah || "",
    "Alamat Domisili": f.alamat_domisili || "",
    "Nama Orang Tua": f.nama_orangtua || "",
    "No Handphone Orang Tua": f.telepon_orangtua || "",
    Motivasi: f.motivasi || "",
    "Pengalaman Organisasi": f.pengalaman_organisasi || "",
    "Golongan Darah": f.golongan_darah || "",
    "Riwayat Penyakit": f.riwayat_penyakit || "",
    "Nomor Pendaftar": a.code,
    Periode: a.period,
    "Pas Foto": a.photoName,
  };
}
