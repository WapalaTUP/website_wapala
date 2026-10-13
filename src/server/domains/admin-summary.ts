import "server-only";
import { getDb } from "../db";
import { assertFresh } from "../auth/sessions";
import type { Principal } from "../auth/policy";
export async function adminSummary(principal: Principal) {
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal);
    const role = principal.role,
      result: Array<{ label: string; value: number; href: string }> = [];
    if (["SUPER_USER", "POH"].includes(role))
      result.push({
        label: "Anggota",
        value: await tx.member.count({ where: { archivedAt: null } }),
        href: "/admin/anggota",
      });
    if (["SUPER_USER", "INVENTARIS"].includes(role)) {
      result.push({
        label: "Alat inventaris",
        value: await tx.equipment.count({ where: { archivedAt: null } }),
        href: "/admin/inventaris",
      });
      result.push({
        label: "Pengajuan perlu ditinjau",
        value: await tx.loan.count({
          where: { archivedAt: null, status: "requested" },
        }),
        href: "/admin/peminjaman",
      });
    }
    result.push({
      label: "Pendaftar Open Recruitment",
      value: await tx.applicant.count({ where: { archivedAt: null } }),
      href: "/admin/or",
    });
    if (["SUPER_USER", "MULTIMEDIA"].includes(role))
      result.push({
        label: "Konfirmasi donasi menunggu",
        value: await tx.donation.count({
          where: { archivedAt: null, status: "waiting" },
        }),
        href: "/admin/donasi",
      });
    return result;
  });
}
