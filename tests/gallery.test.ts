import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getPublicAlbums,
  albumDate,
  getRecentGalleryPhotos,
  getHeroGalleryPhotos,
  canAutoplaySlideshow,
  getCategoryGalleryPhotos,
} from "../src/lib/gallery";
import type { RecordRow } from "../src/lib/types";
import { galleryRecords } from "./fixtures/gallery";
const fixtureAlbums = (records: RecordRow[] = []) =>
  getPublicAlbums([...galleryRecords, ...records], false);

test("backend gallery never repopulates an empty database with preview albums", () => {
  assert.deepEqual(getPublicAlbums([], false), []);
});
test("backend gallery preserves registered album photos instead of reducing an album to its cover", () => {
  const result = getPublicAlbums(
    [
      {
        id: "registered",
        fields: {
          judul: "Kegiatan",
          sampul: "/media/cover",
          gambar: JSON.stringify(["/media/first", "/media/second"]),
        },
      },
    ],
    false,
  );
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].images, [
    "/media/cover",
    "/media/first",
    "/media/second",
  ]);
});

test("an archived source album is absent from both public gallery and slideshow", () => {
  const result = fixtureAlbums([
    { id: "source-a", archived: true, fields: {} },
  ]);
  assert.equal(
    result.some((a) => a.id === "source-a"),
    false,
  );
  assert.equal(
    result.some((a) => a.id === "source-d"),
    true,
  );
});
test("the lower gallery selects five latest pictures from five distinct categories", () => {
  const result = getCategoryGalleryPhotos(fixtureAlbums([]));
  assert.equal(result.length, 5);
  assert.equal(new Set(result.map((p) => p.album.category)).size, 5);
  assert.equal(result[0].album.id, "source-a");
  assert.equal(result[1].album.id, "source-b");
});
test("explicit Play resumes slideshow while its button retains keyboard focus", () => {
  assert.equal(
    canAutoplaySlideshow({
      paused: false,
      hovered: true,
      focused: true,
      reduced: false,
      visible: true,
      modalOpen: false,
      explicitPlay: true,
    }),
    true,
  );
});
test("explicit Play does not override reduced motion, hidden document or an open photo viewer", () => {
  const state = {
    paused: false,
    hovered: false,
    focused: false,
    reduced: false,
    visible: true,
    modalOpen: false,
    explicitPlay: true,
  };
  assert.equal(canAutoplaySlideshow({ ...state, reduced: true }), false);
  assert.equal(canAutoplaySlideshow({ ...state, visible: false }), false);
  assert.equal(canAutoplaySlideshow({ ...state, modalOpen: true }), false);
  assert.equal(canAutoplaySlideshow({ ...state, paused: true }), false);
});
test("manual highlights precede ten recent photos without duplicating a picture", () => {
  const source = fixtureAlbums([
    { id: "source-c", fields: { highlight: "Ya" } },
  ]);
  const result = getHeroGalleryPhotos(source);
  assert.equal(result[0].album.id, "source-c");
  assert.equal(result[0].highlight, true);
  assert.equal(result.length, 11);
  assert.equal(new Set(result.map((p) => p.image)).size, 11);
});
test("an archived manual highlight cannot remain in the homepage slideshow", () => {
  const source = fixtureAlbums([
    { id: "source-c", fields: { highlight: "Ya" }, archived: true },
  ]);
  const result = getHeroGalleryPhotos(source);
  assert.equal(
    result.some((p) => p.album.id === "source-c"),
    false,
  );
});
test("choosing a different highlight photo does not erase the rest of its source album", () => {
  const source = fixtureAlbums([
    {
      id: "source-a",
      fields: {
        sampul: "/fixture/source-a-2.png",
        highlight: "Ya",
      },
    },
  ]);
  const album = source.find((a) => a.id === "source-a")!;
  assert.equal(album.images.length, 6);
  assert.equal(album.images.includes("/fixture/source-a-0.png"), true);
  assert.equal(
    getHeroGalleryPhotos(source)[0].image,
    "/fixture/source-a-2.png",
  );
  assert.equal(getRecentGalleryPhotos(source).length, 10);
});
test("editing a source album replaces its public caption without duplicating it", () => {
  const result = fixtureAlbums([
    {
      id: "source-a",
      fields: { judul: "Ekspedisi terbaru", tanggal: "2026-10-12" },
    },
  ]);
  assert.equal(result.filter((a) => a.id === "source-a").length, 1);
  assert.equal(
    result.find((a) => a.id === "source-a")?.title,
    "Ekspedisi terbaru",
  );
  assert.equal(
    result.find((a) => a.id === "source-a")?.activityDate,
    "2026-10-12",
  );
});
test("a new published album is included in the slideshow source", () => {
  const result = fixtureAlbums([
    {
      id: "new-album",
      fields: {
        judul: "Latihan baru",
        sampul: "/photo.jpg",
        tanggal_upload: "2026-10-13",
      },
    },
  ]);
  const album = result.find((a) => a.id === "new-album");
  assert.equal(album?.image, "/photo.jpg");
  assert.deepEqual(album?.images, ["/photo.jpg"]);
  assert.equal(albumDate(album!), "Diunggah 13 Oktober 2026");
});
test("unknown dates are not presented as verified activity dates", () => {
  assert.equal(
    albumDate({ activityDate: "", uploadedAt: "", dateIsDemo: false }),
    "Tanggal belum tersedia",
  );
  assert.equal(
    albumDate({ activityDate: "2026-10-12", uploadedAt: "", dateIsDemo: true }),
    "Tanggal contoh · 12 Oktober 2026",
  );
});
test("slideshow selects the ten newest photos, not the first ten albums", () => {
  const source = fixtureAlbums([]);
  const recent = getRecentGalleryPhotos(source);
  assert.equal(recent.length, 10);
  assert.equal(new Set(recent.map((p) => p.image)).size, 10);
  assert.equal(recent[0].album.id, "source-a");
  assert.equal(recent[9].album.id, "source-b");
});
test("a newly uploaded album enters the latest-photo list and archived photos stay absent", () => {
  const source = fixtureAlbums([
    {
      id: "new",
      fields: {
        judul: "Baru",
        sampul: "/new.jpg",
        tanggal_upload: "2027-01-01",
      },
    },
    { id: "source-a", fields: {}, archived: true },
  ]);
  const recent = getRecentGalleryPhotos(source);
  assert.equal(recent[0].image, "/new.jpg");
  assert.equal(
    recent.some((p) => p.album.id === "source-a"),
    false,
  );
});
