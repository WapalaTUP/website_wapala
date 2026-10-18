import { memberFields } from "./operational-schema";

/** Keep the strict JSON schema used by main and older releases unchanged. */
export function legacyMemberFields(input: unknown) {
  const { angkatan_wapala: _cohort, ...fields } = memberFields.parse(input);
  return fields;
}

export function mergedMemberFields(row: { fields: unknown; angkatanWapala: string }) {
  return { ...memberFields.parse(row.fields), angkatan_wapala: row.angkatanWapala };
}
