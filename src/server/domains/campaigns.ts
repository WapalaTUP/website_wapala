import { mediaUrlSchema } from "@/lib/media-url";
import "server-only";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../db";
import { DomainError } from "../errors";
import { writeAudit } from "../audit";
import type { Principal } from "../auth/policy";
import { requirePermission } from "../auth/policy";
import { assertFresh } from "../auth/sessions";
import type { RequestContext } from "../security/request-context";
import { assertMediaReferences } from "../media/storage";
const text = (max: number) => z.string().trim().max(max);
const date = z.union([z.literal(""), z.iso.date()]);
// Until media registration is connected, only controlled media endpoints are accepted.
const media = z.union([z.literal(""), mediaUrlSchema()]);
const money = z.number().int().min(1).max(1_000_000_000_000);
export const campaignSchema = z
  .object({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    title: text(200).min(1),
    description: text(10000).min(1),
    target: money,
    collaborator: text(200),
    start: date,
    end: date,
    status: z.enum(["draft", "active", "closed", "archived"]),
    cover: media,
    poster: media,
    qrisImage: media,
    bankAccounts: z
      .array(
        z
          .object({
            id: z.uuid(),
            bank: text(100).min(1),
            number: z
              .string()
              .trim()
              .regex(/^[0-9 -]{3,40}$/),
            holder: text(200).min(1),
          })
          .strict(),
      )
      .max(10),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.start && v.end && v.start > v.end)
      ctx.addIssue({ code: "custom", message: "Periksa tanggal kampanye." });
    const seen = new Set<string>();
    for (const b of v.bankAccounts) {
      const key = b.bank.toLowerCase() + ":" + b.number.replace(/[ -]/g, "");
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: "Rekening duplikat." });
      seen.add(key);
    }
    if (v.id && !v.version)
      ctx.addIssue({ code: "custom", message: "Versi wajib untuk perubahan." });
    if (v.status === "active" && !v.bankAccounts.length && !v.qrisImage)
      ctx.addIssue({
        code: "custom",
        message: "Tambahkan rekening atau QRIS sebelum membuka kampanye.",
      });
  });
export const donationSchema = z
  .object({
    campaignId: z.uuid(),
    name: text(200).min(1),
    amount: money,
    method: z.enum(["bank", "qris"]),
    bankAccountId: z.uuid().optional(),
    proof: media,
  })
  .strict();
type CampaignWithBanks = Prisma.CampaignGetPayload<{
  include: { bankAccounts: true };
}>;
function campaignDto(c: CampaignWithBanks) {
  return {
    id: c.id,
    version: c.version,
    title: c.title,
    description: c.description,
    target: Number(c.target),
    collaborator: c.collaborator,
    start: c.start?.toISOString().slice(0, 10) || "",
    end: c.end?.toISOString().slice(0, 10) || "",
    status: c.status,
    cover: c.cover,
    poster: c.poster,
    qrisImage: c.qrisImage,
    bankAccounts: c.bankAccounts.map(({ id, bank, number, holder }) => ({
      id,
      bank,
      number,
      holder,
    })),
  };
}
const include = { bankAccounts: { orderBy: { position: "asc" as const } } };
export async function saveCampaign(principal: Principal, input: unknown, ctx: RequestContext) {
  requirePermission(principal, "campaigns:write");
  const v = campaignSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "campaigns:write");
    await assertMediaReferences(tx, [v.cover, v.poster, v.qrisImage], ["campaign"], "public");
    if (v.id) {
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id=${v.id}::uuid FOR UPDATE`;
      const old = await tx.campaign.findUnique({ where: { id: v.id } });
      if (!old) throw new DomainError("NOT_FOUND", 404);
      if (old.version !== v.version)
        throw new DomainError(
          "CONFLICT",
          409,
          "Kampanye telah berubah. Muat ulang sebelum menyimpan.",
        );
    }
    // A supplied bank ID must not belong to another campaign.
    const foreign = await tx.campaignBankAccount.count({
      where: {
        id: { in: v.bankAccounts.map((b) => b.id) },
        ...(v.id ? { campaignId: { not: v.id } } : {}),
      },
    });
    if (foreign) throw new DomainError("BANK_CONFLICT", 409);
    const data = {
      title: v.title,
      description: v.description,
      target: v.target,
      collaborator: v.collaborator,
      start: v.start ? new Date(v.start) : null,
      end: v.end ? new Date(v.end) : null,
      status: v.status,
      cover: v.cover,
      poster: v.poster,
      qrisImage: v.qrisImage,
    };
    const c = v.id
      ? await tx.campaign.update({
          where: { id: v.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.campaign.create({ data });
    await tx.campaignBankAccount.deleteMany({ where: { campaignId: c.id } });
    if (v.bankAccounts.length)
      await tx.campaignBankAccount.createMany({
        data: v.bankAccounts.map((b, position) => ({
          ...b,
          number: b.number.replace(/[ -]/g, ""),
          campaignId: c.id,
          position,
        })),
      });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: "CAMPAIGN_SAVED",
      entityId: c.id,
      summary: { status: v.status, banks: v.bankAccounts.length },
      context: ctx,
    });
    return campaignDto(await tx.campaign.findUniqueOrThrow({ where: { id: c.id }, include }));
  });
}
export async function listCampaigns(principal: Principal) {
  requirePermission(principal, "campaigns:write");
  return (
    await getDb().campaign.findMany({
      include,
      orderBy: { createdAt: "desc" },
      take: 500,
    })
  ).map(campaignDto);
}
export async function publicCampaigns() {
  const db = getDb(),
    now = new Date();
  const campaigns = await db.campaign.findMany({
    where: {
      status: "active",
      AND: [
        { OR: [{ start: null }, { start: { lte: now } }] },
        {
          OR: [{ end: null }, { end: { gte: new Date(now.toISOString().slice(0, 10)) } }],
        },
      ],
    },
    include,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const totals = await db.donation.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: campaigns.map((c) => c.id) },
      status: "verified",
      archivedAt: null,
    },
    _sum: { amount: true },
  });
  return campaigns.map((c) => ({
    ...campaignDto(c),
    total: Number(totals.find((t) => t.campaignId === c.id)?._sum.amount || 0),
  }));
}
export async function submitDonation(
  input: unknown,
  ctx: RequestContext,
  transaction?: Prisma.TransactionClient,
) {
  const v = donationSchema.parse(input);
  const execute = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id=${v.campaignId}::uuid FOR UPDATE`;
    const c = await tx.campaign.findUnique({
      where: { id: v.campaignId },
      include,
    });
    const today = new Date(new Date().toISOString().slice(0, 10));
    if (!c || c.status !== "active" || (c.start && c.start > today) || (c.end && c.end < today))
      throw new DomainError("CAMPAIGN_CLOSED", 409, "Kampanye tidak sedang menerima donasi.");
    const bank = c.bankAccounts.find((b) => b.id === v.bankAccountId);
    if (
      (v.method === "bank" && !bank) ||
      (v.method === "qris" && (!c.qrisImage || v.bankAccountId))
    )
      throw new DomainError("PAYMENT_METHOD_INVALID", 400);
    const row = await tx.donation.create({
      data: {
        campaignId: c.id,
        name: v.name,
        amount: v.amount,
        method: v.method,
        proof: v.proof,
        bankAccountId: bank?.id,
        bankAccountLabel: bank ? `${bank.bank} · ${bank.number} · a.n. ${bank.holder}` : null,
      },
    });
    await writeAudit(tx, {
      actorType: "ANONYMOUS",
      action: "DONATION_SUBMITTED",
      entityId: row.id,
      summary: { campaignId: c.id },
      context: ctx,
    });
    return { id: row.id, status: row.status };
  };
  return transaction ? execute(transaction) : getDb().$transaction(execute);
}
export async function listDonations(principal: Principal, campaignId?: string) {
  requirePermission(principal, "campaigns:write");
  if (campaignId) z.uuid().parse(campaignId);
  const rows = await getDb().donation.findMany({
    where: { ...(campaignId ? { campaignId } : {}), archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((d) => ({
    id: d.id,
    campaignId: d.campaignId,
    name: d.name,
    amount: Number(d.amount),
    method: d.method,
    at: d.createdAt.toISOString(),
    status: d.status,
    bankAccountId: d.bankAccountId,
    bankAccountLabel: d.bankAccountLabel,
    proof: d.proof,
    note: d.note,
  }));
}
export async function reviewDonation(
  principal: Principal,
  id: string,
  status: "verified" | "rejected",
  note: string,
  ctx: RequestContext,
) {
  requirePermission(principal, "campaigns:write");
  z.uuid().parse(id);
  z.enum(["verified", "rejected"]).parse(status);
  note = text(2000).parse(note);
  if (status === "rejected" && !note) throw new DomainError("REASON_REQUIRED", 400);
  return getDb().$transaction(async (tx) => {
    await assertFresh(tx, principal, "campaigns:write");
    await tx.$queryRaw`SELECT id FROM "Donation" WHERE id=${id}::uuid FOR UPDATE`;
    const row = await tx.donation.findUnique({ where: { id } });
    if (!row || row.archivedAt) throw new DomainError("NOT_FOUND", 404);
    if (row.status === status) return { id, status };
    if (row.status !== "waiting") throw new DomainError("ALREADY_REVIEWED", 409);
    await tx.donation.update({
      where: { id },
      data: { status, note, reviewedAt: new Date() },
    });
    await writeAudit(tx, {
      actorType: "USER",
      actorId: principal.userId,
      action: status === "verified" ? "DONATION_VERIFIED" : "DONATION_REJECTED",
      entityId: id,
      context: ctx,
    });
    return { id, status };
  });
}
