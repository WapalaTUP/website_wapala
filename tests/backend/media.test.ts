import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { tmpdir } from "node:os";
import { join } from "node:path";
const service = () =>
  import("../../src/server/media/validation").catch(() => null);
test("missing native scanner reports an actionable error and stays fail-closed", async () => {
  const { scanMedia } = await import("../../src/server/media/scanner");
  const previous = process.env.MEDIA_SCANNER;
  process.env.MEDIA_SCANNER = join(tmpdir(), "wapala-nonexistent-scanner.exe");
  try {
    await assert.rejects(
      scanMedia("missing-file"),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "SCANNER_UNAVAILABLE" &&
        error.message.includes("Pemeriksaan keamanan"),
    );
  } finally {
    if (previous === undefined) delete process.env.MEDIA_SCANNER;
    else process.env.MEDIA_SCANNER = previous;
  }
});
test("image uploads are re-encoded without metadata and keep their original aspect ratio", async () => {
  const m = await service();
  assert.ok(m);
  const input = await sharp({
    create: { width: 48, height: 80, channels: 3, background: "green" },
  })
    .withExif({ IFD0: { Artist: "Private metadata" } })
    .jpeg()
    .toBuffer();
  const result = await m.sanitizeImage(input, "image/jpeg");
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(result.mime, "image/webp");
  assert.equal(metadata.width, 48);
  assert.equal(metadata.height, 80);
  assert.equal(metadata.exif, undefined);
});
test("upload boundary rejects disguised HTML/SVG, incorrect signatures and oversized buffers", async () => {
  const m = await service();
  assert.ok(m);
  await assert.rejects(
    m.sanitizeImage(
      Buffer.from("<html><script>alert(1)</script></html>"),
      "image/jpeg",
    ),
  );
  await assert.rejects(
    m.sanitizeImage(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      "image/svg+xml",
    ),
  );
  await assert.rejects(
    m.sanitizeImage(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"),
  );
});
test("storage path is generated from UUID only and cannot traverse the media root", async () => {
  const m = await import("../../src/server/media/paths").catch(() => null);
  assert.ok(m);
  const root = join(tmpdir(), "wapala-test-media");
  assert.equal(
    m.mediaPath(root, "12345678-1234-4234-8234-123456789012", "webp"),
    join(root, "12", "12345678-1234-4234-8234-123456789012.webp"),
  );
  for (const id of ["../secret", "C:\\Windows", "12345678/../secret"])
    assert.throws(() => m.mediaPath(root, id, "webp"));
});
test("malware scanner errors fail closed rather than marking uploads safe", async () => {
  const m = await import("../../src/server/media/scanner").catch(() => null);
  assert.ok(m);
  await assert.rejects(
    m.scanMedia("ignored-test-path", async () => 1),
    (e: unknown) =>
      e instanceof Error && "code" in e && e.code === "MALWARE_DETECTED",
  );
  await assert.rejects(
    m.scanMedia("ignored-test-path", async () => 2),
    (e: unknown) =>
      e instanceof Error && "code" in e && e.code === "SCANNER_UNAVAILABLE",
  );
  await m.scanMedia("ignored-test-path", async () => 0);
});
test("book validation supports bounded EPUB and rejects script-bearing or non-EPUB ZIP archives", async () => {
  const m = await service();
  assert.ok(m);
  const { default: JSZip } = await import("jszip");
  const make = async (chapter: string, mimetype = "application/epub+zip") => {
    const zip = new JSZip();
    zip.file("mimetype", mimetype, { compression: "STORE" });
    zip.file(
      "META-INF/container.xml",
      '<container><rootfiles><rootfile full-path="OEBPS/book.opf" /></rootfiles></container>',
    );
    zip.file(
      "OEBPS/book.opf",
      '<package><manifest><item id="chapter" href="chapter.xhtml" /></manifest></package>',
    );
    zip.file("OEBPS/chapter.xhtml", chapter);
    return zip.generateAsync({ type: "nodebuffer" });
  };
  const good = await make("<html><body><p>Buku Uji</p></body></html>");
  const book = await m.sanitizeBook(good, "application/epub+zip");
  assert.equal(book.extension, "epub");
  await assert.rejects(
    m.sanitizeBook(
      await make("<html><script>alert(1)</script></html>"),
      "application/epub+zip",
    ),
  );
  await assert.rejects(
    m.sanitizeBook(
      await make(
        '<html><img src="https://tracker.example.org/pixel" /></html>',
      ),
      "application/epub+zip",
    ),
  );
  await assert.rejects(
    m.sanitizeBook(await make("<html />", "other/zip"), "application/epub+zip"),
  );
  await assert.rejects(
    m.sanitizeBook(Buffer.alloc(50 * 1024 * 1024 + 1), "application/pdf"),
  );
});
