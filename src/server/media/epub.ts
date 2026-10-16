import "server-only";
import { fromBufferPromise } from "yauzl";
export async function validateEpub(bytes: Buffer) {
  const zip = await fromBufferPromise(bytes, {
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  let count = 0,
    size = 0,
    epub = false,
    container = false,
    packageFile = "";
  const names = new Set<string>(),
    started = Date.now();
  for await (const entry of zip.eachEntry()) {
    count++;
    size += entry.uncompressedSize;
    const name = decodeURIComponent(entry.fileName);
    if (
      count > 2000 ||
      size > 50 * 1024 * 1024 ||
      entry.uncompressedSize > 10 * 1024 * 1024 ||
      Date.now() - started > 15000 ||
      names.has(name) ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").includes("..") ||
      name.includes(":") ||
      entry.generalPurposeBitFlag & 1 ||
      ![0, 8].includes(entry.compressionMethod)
    )
      throw new Error("Invalid EPUB archive");
    names.add(name);
    if (name.endsWith("/")) continue;
    const stream = await zip.openReadStreamPromise(entry),
      chunks: Buffer[] = [];
    const timeout = setTimeout(
      () => stream.destroy(new Error("Archive timeout")),
      Math.max(1, 15000 - (Date.now() - started)),
    );
    let actualSize = 0;
    try {
      for await (const value of stream) {
        actualSize += value.length;
        if (actualSize > entry.uncompressedSize || actualSize > 10 * 1024 * 1024)
          throw new Error("Invalid EPUB entry size");
        chunks.push(Buffer.from(value));
      }
    } finally {
      clearTimeout(timeout);
      stream.destroy();
    }
    const data = Buffer.concat(chunks);
    if (name === "mimetype") {
      if (
        count !== 1 ||
        entry.compressionMethod !== 0 ||
        data.toString() !== "application/epub+zip"
      )
        throw new Error("Invalid EPUB mimetype");
      epub = true;
    }
    if (/\.(?:xml|opf|html|xhtml|css|svg|ncx)$/i.test(name)) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      if (
        text.includes("\0") ||
        /<!DOCTYPE|<!ENTITY|<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|<meta[^>]*http-equiv/i.test(
          text,
        )
      )
        throw new Error("Active EPUB content");
      for (const match of text.matchAll(/\b(?:src|href|srcset)\s*=\s*["']([^"']*)["']/gi)) {
        const uri = decodeURIComponent(match[1].trim());
        if (uri.startsWith("/") || uri.includes(":") || /&(?:#|colon;)/i.test(uri))
          throw new Error("External EPUB reference");
      }
      if (/(?:url\(\s*["']?|@import\s*["']?)(?:https?:|\/\/|javascript:|data:)/i.test(text))
        throw new Error("External EPUB styles");
      if (name === "META-INF/container.xml") {
        container = true;
        packageFile = /full-path\s*=\s*["']([^"']+)["']/.exec(text)?.[1] || "";
      }
    }
  }
  if (!epub || !container || !packageFile || !names.has(packageFile))
    throw new Error("Incomplete EPUB package");
}
