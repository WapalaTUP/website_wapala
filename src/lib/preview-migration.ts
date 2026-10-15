import type { DemoState, Campaign } from "./types";
export function migratePreviewState(input: DemoState): DemoState {
  const state = structuredClone(input);
  const s = state.settings;
  s.managementPeriod ||= "2026";
  const accounts = [
    { role: "POH", old: "poh@example.com", email: "POH@wapala.org" },
    {
      role: "Inventaris",
      old: "inventaris@example.com",
      email: "Logistik@wapala.org",
    },
    {
      role: "Multimedia",
      old: "multimedia@example.com",
      email: "Kerjasama@wapala.org",
    },
  ];
  state.records.pengguna ||= [];
  for (const account of accounts) {
    const existing = state.records.pengguna.filter(
      (u) => u.fields.role === account.role,
    );
    for (const user of existing)
      if (user.fields.email?.toLowerCase() === account.old)
        user.fields.email = account.email;
    if (!existing.length)
      state.records.pengguna.push({
        id: "default-" + account.role,
        fields: {
          nama: "Admin " + account.role,
          email: account.email,
          role: account.role,
          status: "Aktif",
        },
      });
  }
  if (!Array.isArray(state.campaigns)) {
    const legacy: Campaign = {
      id: "legacy-campaign",
      title: s.campaignTitle,
      description: s.campaignDescription,
      cover: "/images/activities/penanaman.png",
      qrisImage: "",
      target: s.campaignTarget,
      bank: s.campaignBank,
      account: s.campaignAccount,
      collaborator: s.campaignCollaborator,
      start: "",
      end: s.campaignEnd,
      status: s.donationActive ? "active" : "draft",
    };
    state.campaigns = [legacy];
  }
  if (
    state.donations.some((d) => !d.campaignId) &&
    !state.campaigns.some((c) => c.id === "legacy-campaign")
  ) {
    state.campaigns.push({
      id: "legacy-campaign",
      title: s.campaignTitle,
      description: s.campaignDescription,
      cover: "",
      qrisImage: "",
      target: s.campaignTarget,
      bank: s.campaignBank,
      account: s.campaignAccount,
      collaborator: s.campaignCollaborator,
      start: "",
      end: s.campaignEnd,
      status: "closed",
    });
  }
  state.donations = state.donations.map((d) => ({
    ...d,
    campaignId: d.campaignId || "legacy-campaign",
  }));
  state.campaigns = state.campaigns.map((c) => ({
    ...c,
    poster: c.poster || "",
    bankAccounts:
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
        : []),
  }));
  return state;
}
