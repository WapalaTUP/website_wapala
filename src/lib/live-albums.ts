// Public albums verified against the active WAPALA gallery, 13 October 2026.
// The live page does not expose activity/upload dates; do not infer them from filenames.
const rows = [
  [
    "argopuro",
    "ekspedisi-gunung-argopuro",
    "Ekspedisi Gunung Argopuro",
    6,
    "Gunung Hutan",
    "Argopuro",
    "Perjalanan eksplorasi Argopuro, pengamatan flora dan fauna, serta penelusuran sejarah kawasan.",
  ],
  [
    "penanaman",
    "penanaman-dalam-rangka-peringatan-hut-wipala-ke-33",
    "Penanaman dalam Peringatan HUT Wipala ke-33",
    8,
    "Konservasi",
    "Banyumas",
    "Penanaman pohon bersama Wipala untuk memperingati ulang tahun organisasi ke-33.",
  ],
  [
    "fun-climb",
    "fun-run-and-climb-eigerian-purwokerto",
    "Fun Run and Climb × Eigerian Purwokerto",
    6,
    "Rock Climbing",
    "Purwokerto",
    "Lari dan wall climbing bersama komunitas untuk melatih kebugaran dan mempererat kebersamaan.",
  ],
  [
    "rafting",
    "latihan-rafting",
    "Latihan Rafting",
    5,
    "Rafting",
    "Sungai Elo",
    "Latihan pengarungan bersama WAPALA dan Mapala Silvagama di Sungai Elo.",
  ],
  [
    "sinar",
    "sinar-sinau-bareng-relawan",
    "SINAR (Sinau Bareng Relawan)",
    8,
    "Relawan",
    "Banyumas",
    "Belajar dan berdiskusi bersama relawan dalam semangat kolaborasi dan kepedulian.",
  ],
  [
    "rabu-produktif",
    "rabu-produktif",
    "Rabu Produktif",
    5,
    "Rock Climbing",
    "Purwokerto",
    "Latihan rutin wall climbing dan Single Rope Technique setiap Rabu.",
  ],
  [
    "donor-darah",
    "donor-darah",
    "Donor Darah",
    5,
    "Aksi sosial",
    "Purwokerto",
    "Aksi kepedulian untuk membantu ketersediaan darah bagi masyarakat.",
  ],
  [
    "pelantikan-alb-wapala",
    "pelantikan-alb-wapala",
    "Pelantikan ALB WAPALA",
    4,
    "Organisasi",
    "WAPALA",
    "Pelantikan Anggota Luar Biasa sebagai bagian dari perjalanan keluarga WAPALA.",
  ],
  [
    "pelantikan-anggota-luar-biasa",
    "pelantikan-anggota-luar-biasa",
    "Pelantikan Anggota Luar Biasa",
    2,
    "Organisasi",
    "WAPALA",
    "Momen wisuda dan langkah berikutnya bagi anggota WAPALA.",
  ],
  [
    "hut-wapala-xxi",
    "hut-wapala-xxi",
    "HUT WAPALA XXI",
    6,
    "Organisasi",
    "WAPALA",
    "Dokumentasi peringatan ulang tahun WAPALA ke-21.",
  ],
  [
    "rafting-wapala-x-mapala-silvagama",
    "rafting-wapala-x-mapala-silvagama",
    "Rafting Wapala × Mapala Silvagama",
    7,
    "Rafting",
    "Sungai Elo",
    "Dua kali pengarungan bersama untuk melatih keterampilan, koordinasi, dan pengalaman arung jeram.",
  ],
  [
    "fun-climbing",
    "fun-climbing",
    "Fun Climbing",
    8,
    "Rock Climbing",
    "Purwokerto",
    "Kegiatan panjat berhadiah untuk memperingati HUT WAPALA XXI.",
  ],
] as const;
// Sorting keys from public storage object identifiers, not asserted activity dates.
const photoOrders: Record<string, number[]> = {
  "ekspedisi-gunung-argopuro": [
    1790752188, 1790752187, 1790752185, 1790752183, 1790752181, 1790752179,
  ],
  "penanaman-dalam-rangka-peringatan-hut-wipala-ke-33": [
    1784454002, 1784454002, 1784454002, 1784454002, 1784454002, 1784454002, 1784454002, 1784454002,
  ],
  "fun-run-and-climb-eigerian-purwokerto": [
    1784453432, 1784453432, 1784453432, 1784453432, 1784453432, 1784453432,
  ],
  "latihan-rafting": [1784452457, 1784452457, 1784452457, 1784452457, 1784452457],
  "sinar-sinau-bareng-relawan": [
    1784451825, 1784451825, 1784451825, 1784451825, 1784451825, 1784451825, 1784451825, 1784451825,
  ],
  "rabu-produktif": [1784450949, 1784450949, 1784450949, 1784450949, 1784450949],
  "donor-darah": [1784448025, 1784448025, 1784448025, 1784448025, 1784448025],
  "pelantikan-alb-wapala": [1790687775, 1790687773, 1790687771, 1790687769],
  "pelantikan-anggota-luar-biasa": [1790687472, 1790687469],
  "hut-wapala-xxi": [1790685813, 1790685811, 1790685809, 1790685808, 1790685806, 1790685805],
  "rafting-wapala-x-mapala-silvagama": [
    1784452986, 1784452986, 1784452986, 1784452986, 1784452986, 1784452986, 1784452986,
  ],
  "fun-climbing": [
    1784450078, 1784450078, 1784450078, 1784450078, 1784450078, 1784450078, 1784450078, 1784450078,
  ],
};
export const liveAlbums = rows.map(([id, slug, title, count, category, location, description]) => {
  const images = Array.from(
    { length: count },
    (_, i) => "/images/albums/" + slug + "-" + i + ".png",
  );
  return {
    id,
    title,
    category,
    location,
    description,
    image: images[0],
    images,
    photoOrders: photoOrders[slug],
    source: "https://www.wapalatelkomuniversity.org/album",
  };
});
