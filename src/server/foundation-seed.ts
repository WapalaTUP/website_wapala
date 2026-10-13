import "server-only";
import { getDb } from "./db";
export async function seedFoundation() {
  await getDb().bootstrapState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  await getDb().siteSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      managementYear: 2026,
      recruitmentActive: false,
      config: {
        organization: "Wahana Pencinta Alam Telkom University",
        email: "Wapalatelkomuniversity@gmail.com",
      },
    },
    update: {},
  });
}
