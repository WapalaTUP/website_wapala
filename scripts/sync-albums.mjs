// Public-source binary assets only. Metadata is printed for review, not imported as private data.
import fs from "node:fs/promises";
import path from "node:path";
const source = "https://www.wapalatelkomuniversity.org/album";
const response = await fetch(source);
if (!response.ok) throw new Error("Album HTTP " + response.status);
const html = await response.text();
const clean = (value) =>
  value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
const cards = [
  ...html.matchAll(
    /<div class="album-card"[\s\S]*?data-bs-target="#modalAlbum([^"]+)"([\s\S]*?)<\/small>/g,
  ),
];
if (cards.length !== 12)
  throw new Error("Review required: album count " + cards.length);
const destination = path.resolve("public/images/albums");
await fs.mkdir(destination, { recursive: true });
const rows = [];
for (const card of cards) {
  const slug = card[1],
    block = card[2];
  const title = clean(
    block.match(/class="album-title">([\s\S]*?)<\/div>/)?.[1] || "",
  );
  const description = clean(
    block.match(/class="album-desc">([\s\S]*?)<\/div>/)?.[1] || "",
  );
  const start = html.indexOf('id="modalAlbum' + slug + '"');
  const end = html.indexOf("<!--", start + 1);
  const modal = html.slice(start, end === -1 ? html.length : end);
  // Stop at the next modal so that photos cannot leak between albums.
  const next = modal.indexOf('class="modal fade', 20);
  const section = next === -1 ? modal : modal.slice(0, next);
  const urls = [
    ...new Set(
      [...section.matchAll(/<img\s+src="(https:[^"]+)"/g)].map((m) => m[1]),
    ),
  ];
  const cover = block.match(/<img\s+src="([^"]+)"/)?.[1];
  if (!title || !cover || !urls.length)
    throw new Error("Incomplete album " + slug);
  const sources = [cover, ...urls.filter((u) => u !== cover)];
  const images = [];
  for (let i = 0; i < sources.length; i++) {
    const image = "/images/albums/" + slug + "-" + i + ".png";
    const filename = path.join(destination, slug + "-" + i + ".png");
    try {
      await fs.access(filename);
    } catch {
      const res = await fetch(sources[i]);
      if (!res.ok) throw new Error("Photo HTTP " + res.status);
      await fs.writeFile(filename, Buffer.from(await res.arrayBuffer()));
    }
    images.push(image);
  }
  rows.push({
    id: slug,
    title,
    description,
    image: images[0],
    images,
    photoOrders: sources.map((u) => Number(u.match(/\/([0-9]+)_/)?.[1] || 0)),
    source,
  });
}
process.stdout.write(JSON.stringify(rows, null, 2));
