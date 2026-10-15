import type { DemoState } from "./types";
export function annualPeriod(year: string) {
  return /^\d{4}$/.test(year.trim()) && Number(year) >= 2004
    ? "Periode " + year.trim()
    : null;
}
export function migrateAnnualPeriods(state: DemoState): DemoState {
  const normalize = (
    value: string,
    fallback = String(new Date().getFullYear()),
  ) =>
    annualPeriod(value.match(/\b\d{4}\b/)?.[0] || fallback) ||
    "Periode " + fallback;
  const period = normalize(state.settings.period);
  return {
    ...state,
    settings: {
      ...state.settings,
      period,
      periods: [
        ...new Set([
          period,
          ...state.settings.periods.map((p) => normalize(p)),
        ]),
      ],
    },
    applicants: state.applicants.map((a) => ({
      ...a,
      period: normalize(a.period, a.createdAt.slice(0, 4)),
    })),
  };
}
