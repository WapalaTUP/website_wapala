import type { DemoState } from "./types";
export function persistDraft(
  draft: DemoState,
  storage: Pick<Storage, "setItem">,
) {
  try {
    storage.setItem("wapala.frontend.v1", JSON.stringify(draft));
  } catch {
    throw new Error(
      "Data belum tersimpan. Penyimpanan browser penuh atau tidak tersedia; kurangi ukuran foto / file lalu coba lagi.",
    );
  }
}
