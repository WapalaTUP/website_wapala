import type { DemoState, Role } from "./types";
export type PasswordChoice = "keep" | "request-new";
export type RolloverPreview = {
  archiveIds: string[];
  carryIds: string[];
  resetUserIds: string[];
};
export function previewRollover(
  state: DemoState,
  year: string,
  choices: Record<string, PasswordChoice>,
): RolloverPreview {
  if (
    !/^\d{4}$/.test(year) ||
    Number(year) < 2004 ||
    Number(year) <= Number(state.settings.managementPeriod)
  )
    throw new Error("Pilih tahun empat digit yang lebih baru dari kepengurusan saat ini.");
  const loans = state.loans.filter((l) => !l.archived);
  return {
    archiveIds: loans
      .filter((l) => ["Dikembalikan", "Ditolak"].includes(l.status))
      .map((l) => l.id),
    carryIds: loans.filter((l) => !["Dikembalikan", "Ditolak"].includes(l.status)).map((l) => l.id),
    resetUserIds: state.records.pengguna
      .filter(
        (u) => !u.archived && u.fields.role !== "Super User" && choices[u.id] === "request-new",
      )
      .map((u) => u.id),
  };
}
export function applyRollover(
  state: DemoState,
  year: string,
  choices: Record<string, PasswordChoice>,
  actor: Role,
) {
  if (actor !== "Super User") throw new Error("Hanya Super User dapat mereset kepengurusan.");
  const next = previewRollover(state, year, choices),
    origin = state.settings.managementPeriod;
  for (const loan of state.loans) {
    if (loan.archived) continue;
    loan.originPeriod ||= origin;
    if (next.archiveIds.includes(loan.id)) loan.archived = true;
    else loan.managementPeriod = year;
  }
  for (const id of next.resetUserIds) {
    const user = state.records.pengguna.find((u) => u.id === id)!;
    user.fields.resetRequired = "Ya";
    user.fields.resetRequestedAt = new Date().toISOString();
  }
  state.settings.managementPeriod = year;
}
export function requestSuperUserReset(state: DemoState, actor: Role) {
  if (actor !== "Super User") throw new Error("Hanya Super User.");
  state.settings.superUserResetRequestedAt = new Date().toISOString();
}
