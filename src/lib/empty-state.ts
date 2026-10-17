import type { DemoState } from "./types";
import { DEFAULT_CONTENT_TAGS } from "./content-tags";
export function emptyState(): DemoState {
  return {
    backend: true,
    contentTags: [...DEFAULT_CONTENT_TAGS],
    campaigns: [],
    publicEquipment: [],
    equipment: [],
    loans: [],
    applicants: [],
    donations: [],
    audit: [],
    records: { anggota: [], konten: [], galeri: [], buku: [], pengguna: [] },
    settings: {
      managementPeriod: "",
      recruitmentActive: false,
      donationActive: false,
      period: "",
      periods: [],
      email: "",
      whatsapp: "",
      address: "",
      instagram: "",
      tiktok: "",
      youtube: "",
      map: "",
      campaignTitle: "",
      campaignDescription: "",
      campaignTarget: 0,
      campaignBank: "",
      campaignAccount: "",
      campaignCollaborator: "",
      campaignEnd: "",
    },
  };
}
