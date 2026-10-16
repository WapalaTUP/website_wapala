import { mediaUrlSchema } from "@/lib/media-url";
import "server-only";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { hmacToken } from "../security/tokens";
import { requirePermission, type Principal } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import { writeAudit } from "../audit";
import type { RequestContext } from "../security/request-context";
export const periodSchema = z
  .object({ year: z.number().int().min(2004).max(2200), active: z.boolean() })
  .strict();
const text = z.string().trim().min(1).max(300),
  optional = z.string().trim().max(2000).optional().default("");
export const applicantFields = z
  .object({
    nama: text,
    nim: text.max(40),
    prodi: text,
    telepon: z.string().regex(/^\+?[0-9 -]{8,20}$/),
    email: z.email().max(254),
    tempat_lahir: text,
    tanggal_lahir: z.iso.date(),
    jenis_kelamin: z.enum(["Laki-laki", "Perempuan"]),
    golongan_darah: z.enum(["A", "B", "AB", "O", "Tidak tahu"]),
    agama: text,
    alamat_rumah: text,
    alamat_domisili: text,
    nama_orangtua: text,
    telepon_orangtua: z.string().regex(/^\+?[0-9 -]{8,20}$/),
    motivasi: text.max(2000),
    pengalaman_organisasi: optional,
    riwayat_penyakit: optional,
  })
  .strict();
export const applicantSchema = z
  .object({
    year: periodSchema.shape.year,
    fields: applicantFields,
    photo: z.union([z.literal(""), mediaUrlSchema()]),
  })
  .strict();
export async function setRecruitmentPeriod(
  principal: Principal,
  year: number,
  active: boolean,
  ctx: RequestContext,
) {
  requirePermission(principal, "recruitment:write");
  periodSchema.parse({ year, active });
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "recruitment:write");
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('wapala:recruitment'))::text`;
    if (active)
      await tx.recruitmentPeriod.updateMany({
        where: { active: true, year: { not: year } },
        data: { active: false },
      });
    const period = await tx.recruitmentPeriod.upsert({
      where: { year },
      create: { year, active },
      update: { active },
    });
    await tx.siteSettings.update({
      where: { id: 1 },
      data: {
        recruitmentActive: (await tx.recruitmentPeriod.count({ where: { active: true } })) > 0,
      },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "RECRUITMENT_PERIOD_UPDATED",
      entityId: String(year),
      summary: { year, active },
      context: ctx,
    });
    return {
      year: period.year,
      active: period.active,
      label: `Periode ${period.year}`,
    };
  });
}
export async function listPeriods(principal: Principal) {
  requirePermission(principal, "recruitment:read");
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "recruitment:read");
    return (await tx.recruitmentPeriod.findMany({ orderBy: { year: "desc" } })).map((p) => ({
      year: p.year,
      active: p.active,
      label: `Periode ${p.year}`,
    }));
  });
}
export async function submitApplicant(
  input: unknown,
  ctx: RequestContext,
  transaction?: Prisma.TransactionClient,
) {
  const v = applicantSchema.parse(input);
  try {
    const execute = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT year FROM "RecruitmentPeriod" WHERE year=${v.year} FOR UPDATE`;
      const period = await tx.recruitmentPeriod.findUnique({
        where: { year: v.year },
      });
      if (!period?.active)
        throw new DomainError("PERIOD_CLOSED", 409, "Pendaftaran periode ini ditutup.");
      const code = `OR${v.year}-${randomBytes(8).toString("hex").toUpperCase()}`;
      const row = await tx.applicant.create({
        data: {
          code,
          year: v.year,
          nim: v.fields.nim.toLowerCase(),
          fields: v.fields,
          phoneDigest: hmacToken(
            "applicant-phone:" + v.fields.telepon.replace(/[^0-9]/g, ""),
            getConfig().securityKey,
          ),
          photo: v.photo,
        },
      });
      await writeAudit(tx, {
        actorType: "ANONYMOUS",
        action: "APPLICANT_SUBMITTED",
        entityId: row.id,
        summary: { year: v.year },
        context: ctx,
      });
      return { code: row.code, year: row.year };
    };
    return await (transaction ? execute(transaction) : getDb().$transaction(execute));
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      throw new DomainError(
        "ALREADY_REGISTERED",
        409,
        "Identitas telah terdaftar pada periode ini.",
      );
    throw e;
  }
}
export async function listApplicants(principal: Principal, year: number) {
  requirePermission(principal, "recruitment:read");
  periodSchema.shape.year.parse(year);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "recruitment:read");
    return (
      await tx.applicant.findMany({
        where: { year },
        orderBy: { createdAt: "desc" },
        take: 2000,
      })
    ).map((a) => ({
      id: a.id,
      code: a.code,
      year: a.year,
      period: String(a.year),
      fields: applicantFields.parse(a.fields),
      photo: a.photo,
      createdAt: a.createdAt.toISOString(),
      revisions: a.revisions,
      archived: !!a.archivedAt,
    }));
  });
}
