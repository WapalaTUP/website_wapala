import type { BankAccount, Campaign, DemoState, Donation } from "./types";
export function getBankAccounts(c: Campaign): BankAccount[] {
  return (
    c.bankAccounts ??
    (c.bank && c.account
      ? [
          {
            id: c.id + "-bank-legacy",
            bank: c.bank,
            number: c.account,
            holder: "",
          },
        ]
      : [])
  );
}
export function campaignTotal(donations: Donation[], campaignId: string) {
  return donations
    .filter(
      (d) =>
        d.campaignId === campaignId &&
        !d.archived &&
        d.status === "Terverifikasi",
    )
    .reduce((n, d) => n + d.amount, 0);
}
export function activeCampaigns(state: DemoState) {
  return state.campaigns.filter((c) => c.status === "active");
}
export function canConfirmDonation(state: DemoState, id: string) {
  return activeCampaigns(state).some((c) => c.id === id);
}
export function validateCampaign(c: Campaign) {
  if (!c.title.trim() || !c.description.trim())
    return "Lengkapi judul dan keterangan kampanye.";
  if (!Number.isFinite(c.target) || c.target <= 0)
    return "Target harus lebih dari nol.";
  const validDate = (v: string) =>
    !v ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v);
  if (
    !validDate(c.start) ||
    !validDate(c.end) ||
    (c.start && c.end && c.start > c.end)
  )
    return "Periksa tanggal mulai dan selesai.";
  const banks = getBankAccounts(c),
    seen = new Set<string>();
  for (const b of banks) {
    if (!b.bank.trim() || !b.number.trim() || !b.holder.trim())
      return "Lengkapi nama bank, nomor rekening, dan nama pemilik setiap rekening.";
    const key =
      b.bank.trim().toLowerCase() + ":" + b.number.replace(/[\s-]/g, "");
    if (seen.has(key)) return "Rekening yang sama tercantum lebih dari sekali.";
    seen.add(key);
  }
  return "";
}
export const blankCampaign = (): Campaign => ({
  id: crypto.randomUUID(),
  title: "",
  description: "",
  cover: "",
  qrisImage: "",
  bankAccounts: [],
  poster: "",
  target: 1000000,
  bank: "",
  account: "",
  collaborator: "WAPALA Telkom University",
  start: "",
  end: "",
  status: "draft",
});
