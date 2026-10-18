import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeVideo } from "./validation";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("MP4 validation rejects spoofed signatures, truncated boxes and wrong MIME", async () => {
  assert.equal(typeof sanitizeVideo, "function");
  for (const bytes of [
    Buffer.from("not a video"),
    Buffer.from("00000018ftypisom0000"),
    Buffer.from([0, 0, 0, 255, 102, 116, 121, 112]),
  ])
    await assert.rejects(() => sanitizeVideo(bytes, "video/mp4"));
  await assert.rejects(() => sanitizeVideo(Buffer.alloc(10), "image/png"));
  await assert.rejects(() => sanitizeVideo(Buffer.alloc(50 * 1024 * 1024 + 1), "video/mp4"));
});
test("a real MP4 is probed for codec, dimensions and duration", async () => {
  const bytes = await readFile(join(process.cwd(), "src/server/media/fixtures/album-video.mp4"));
  const result = await sanitizeVideo(bytes, "video/mp4");
  assert.equal(result.extension, "mp4");
  assert.equal(result.width, 160);
  assert.equal(result.height, 120);
  assert.deepEqual(result.bytes, bytes);
});
test("phone video rotation yields portrait display dimensions", async () => {
  const bytes = await readFile(
    join(process.cwd(), "src/server/media/fixtures/album-video-portrait.mp4"),
  );
  const result = await sanitizeVideo(bytes, "video/mp4");
  assert.equal(result.width, 120);
  assert.equal(result.height, 160);
});

test("a longer valid MP4 does not enumerate packets and frames during metadata inspection", async () => {
  const folder = await mkdtemp(join(tmpdir(), "wapala-video-test-"));
  try {
    const file = join(folder, "long.mp4");
    await promisify(execFile)(
      "ffmpeg",
      [
        "-v",
        "error",
        "-threads",
        "1",
        "-stream_loop",
        "89",
        "-i",
        join(process.cwd(), "src/server/media/fixtures/album-video.mp4"),
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        file,
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
    const bytes = await readFile(file);
    const result = await sanitizeVideo(bytes, "video/mp4");
    assert.equal(result.width, 160);
    assert.equal(result.height, 120);
    assert.deepEqual(result.bytes, bytes);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("MP4-looking boxes without an actual video stream are rejected", async () => {
  const box = (name: string, payload = Buffer.alloc(8)) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length);
    header.write(name, 4, "ascii");
    return Buffer.concat([header, payload]);
  };
  const bytes = Buffer.concat([box("ftyp", Buffer.from("isom0000")), box("moov"), box("mdat")]);
  await assert.rejects(() => sanitizeVideo(bytes, "video/mp4"));
});
test("missing video processor fails closed", async () => {
  const previous = process.env.MEDIA_FFPROBE;
  process.env.MEDIA_FFPROBE = "wapala-nonexistent-ffprobe-test";
  try {
    const bytes = await readFile(join(process.cwd(), "src/server/media/fixtures/album-video.mp4"));
    await assert.rejects(
      () => sanitizeVideo(bytes, "video/mp4"),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "VIDEO_PROCESSOR_UNAVAILABLE",
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_FFPROBE;
    else process.env.MEDIA_FFPROBE = previous;
  }
});
