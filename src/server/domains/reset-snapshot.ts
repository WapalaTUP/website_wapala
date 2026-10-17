import { createHash } from "node:crypto";

type Selection = { target: string; mode: string; id?: string };
export function dataResetSnapshot(
  selection: Selection,
  rows: unknown,
  blocked: number,
  dependencies: unknown,
) {
  // Preview and execution construct Selection in different key orders.
  // Hash explicit fields in a fixed order, never the caller's object layout.
  return createHash("sha256")
    .update(
      JSON.stringify({
        target: selection.target,
        mode: selection.mode,
        id: selection.id ?? null,
        rows,
        blocked,
        dependencies,
      }),
    )
    .digest("hex");
}
