import { test } from "node:test";
import assert from "node:assert/strict";
import { playAlbumVideo, albumPlaybackEmbed } from "../src/lib/album-autoplay";

test("uploaded video tries autoplay with sound first", async () => {
  const attempts: boolean[] = [];
  const video = {
    muted: false,
    async play() {
      attempts.push(this.muted);
    },
  };
  await playAlbumVideo(video, () => true);
  assert.deepEqual(attempts, [false]);
});

test("a browser autoplay denial retries muted without forcing sound back on", async () => {
  const attempts: boolean[] = [];
  const video = {
    muted: false,
    async play() {
      attempts.push(this.muted);
      if (!this.muted) throw new DOMException("Interaction required", "NotAllowedError");
    },
  };
  await playAlbumVideo(video, () => true);
  assert.deepEqual(attempts, [false, true]);
  assert.equal(video.muted, true);
});

test("leaving the visible panel prevents a delayed muted retry", async () => {
  let active = true;
  let attempts = 0;
  const video = {
    muted: false,
    async play() {
      attempts++;
      active = false;
      throw new DOMException("Interaction required", "NotAllowedError");
    },
  };
  await playAlbumVideo(video, () => active);
  assert.equal(attempts, 1);
  assert.equal(video.muted, false);
});

test("media loading errors are not mistaken for autoplay policy denial", async () => {
  let attempts = 0;
  const video = {
    muted: false,
    async play() {
      attempts++;
      throw new DOMException("Unsupported source", "NotSupportedError");
    },
  };
  await playAlbumVideo(video, () => true);
  assert.equal(attempts, 1);
  assert.equal(video.muted, false);
});

test("blocked muted playback leaves native play controls usable without an unhandled rejection", async () => {
  let attempts = 0;
  const video = {
    muted: false,
    async play() {
      attempts++;
      throw new DOMException("Autoplay blocked", "NotAllowedError");
    },
  };
  await assert.doesNotReject(() => playAlbumVideo(video, () => true));
  assert.equal(attempts, 2);
});

test("TikTok and YouTube embeds request autoplay without muted playback", () => {
  const tiktok = new URL(albumPlaybackEmbed("https://www.tiktok.com/@wapala/video/123456789")!);
  assert.equal(tiktok.searchParams.get("autoplay"), "1");
  assert.equal(tiktok.searchParams.get("muted"), "0");
  const youtube = new URL(albumPlaybackEmbed("https://youtu.be/M7lc1UVf-VE")!);
  assert.equal(youtube.origin, "https://www.youtube-nocookie.com");
  assert.equal(youtube.searchParams.get("autoplay"), "1");
  assert.equal(youtube.searchParams.get("playsinline"), "1");
  assert.notEqual(youtube.searchParams.get("mute"), "1");
});

test("Instagram keeps its supported embed rather than inventing autoplay controls", () => {
  assert.equal(
    albumPlaybackEmbed("https://www.instagram.com/reel/Ab_C-12/"),
    "https://www.instagram.com/reel/Ab_C-12/embed/",
  );
  assert.equal(albumPlaybackEmbed("https://youtube.com.evil.test/watch?v=M7lc1UVf-VE"), undefined);
});
