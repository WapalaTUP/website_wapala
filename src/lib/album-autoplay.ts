import { parseExternalAlbumUrl } from "./album-media";

type VideoPlayer = { muted: boolean; play: () => Promise<void> };

/** Try sound first; an inactive panel must never start a delayed fallback. */
export async function playAlbumVideo(video: VideoPlayer, active: () => boolean) {
  if (!active()) return;
  try {
    await video.play();
  } catch (error) {
    if (!active() || video.muted || !(error instanceof Error) || error.name !== "NotAllowedError")
      return;
    video.muted = true;
    try {
      await video.play();
    } catch {
      // Native controls remain available when even muted autoplay is blocked.
    }
  }
}

export function albumPlaybackEmbed(src: string) {
  const external = parseExternalAlbumUrl(src);
  if (!external) return undefined;
  if (external.type === "instagram") return external.embed;
  const params =
    external.type === "tiktok"
      ? new URLSearchParams({
          autoplay: "1",
          muted: "0",
          description: "0",
          music_info: "0",
          rel: "0",
        })
      : new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0" });
  return `${external.embed}?${params}`;
}
