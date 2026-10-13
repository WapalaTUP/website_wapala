export const photos = {
  rafting: "/assets/placeholder.svg",
  argopuro: "/assets/placeholder.svg",
  planting: "/assets/placeholder.svg",
  climb: "/assets/placeholder.svg",
  training: "/assets/placeholder.svg",
  wall: "/assets/placeholder.svg",
};
export const divisions = [
  {
    name: "Gunung Hutan",
    slug: "gunung-hutan",
    description:
      "Membaca medan, mengenali arah, dan belajar hidup di alam terbuka.",
    detail:
      "Navigasi darat, teknik perjalanan, survival, dan keselamatan pendakian menjadi bekal dalam setiap perjalanan.",
    position: "33.333% center",
  },
  {
    name: "Rock Climbing",
    slug: "rock-climbing",
    description: "Menemukan pijakan. Menjaga kepercayaan pada satu ikatan.",
    detail:
      "Teknik panjat, pengenalan alat, sistem pengaman, dan latihan bersama untuk membangun keterampilan yang bertanggung jawab.",
    position: "0% center",
  },
  {
    name: "Caving",
    slug: "caving",
    description: "Mengenal cerita alam yang tersimpan di bawah permukaan.",
    detail:
      "Pengetahuan gua, teknik penelusuran, dan keselamatan dalam lingkungan yang membutuhkan persiapan serta kerja sama.",
    position: "66.666% center",
  },
  {
    name: "Rafting",
    slug: "rafting",
    description: "Membaca arus, menjaga irama, dan melangkah bersama satu tim.",
    detail:
      "Teknik pengarungan, pengenalan karakter sungai, penyelamatan di arus deras, dan latihan kerja sama menjadi bekal divisi Rafting.",
    position: "100% center",
  },
];
export const vision =
  "WAPALA Telkom University sebagai organisasi yang memiliki kepedulian tinggi terhadap alam dan lingkungan sekitar serta dapat meningkatkan intelektualitas, jasmani, rohani, dan jiwa ksatria anggotanya.";
export const missions = [
  "Memperluas hubungan kerja sama dan mempererat rasa kekeluargaan yang harmonis serta saling menguntungkan dengan organisasi eksternal.",
  "Menyelenggarakan kegiatan yang dapat membantu masyarakat dan turut serta dalam usaha pelestarian alam dan lingkungan hidup.",
  "Membentuk anggota WAPALA Telkom University yang mampu berpikir dan bertindak kritis, bertanggung jawab, berwawasan luas yang berlandaskan nilai-nilai kekeluargaan.",
  "Mengembangkan kegiatan dalam rangka peningkatan kualitas tata kelola organisasi.",
];
export const history = [
  ["28 September 2004", "WAPALA Akatel"],
  ["28 September 2013", "WAPALA STT Telematika Telkom"],
  ["16 September 2017", "WAPALA IT Telkom"],
  ["4 Oktober 2024", "WAPALA Telkom University"],
];
// Public catalogs are populated from reviewed database records after import.
export const generations: Array<{
  number: string;
  name: string;
  label: string;
  image: string;
}> = [];
export const albums: Array<{
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  image: string;
  images: string[];
  photoOrders: number[];
  source: string;
}> = [];
export const books: Array<{
  id: string;
  title: string;
  category: string;
  description: string;
  file: string;
  image: string;
}> = [];
export const conditions = [
  "Baik",
  "Kotor",
  "Rusak Ringan",
  "Rusak Berat",
  "Hilang",
] as const;
export const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
export const date = (d: string) =>
  d
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok",
      }).format(new Date(d.length === 10 ? d + "T12:00:00+07:00" : d))
    : "—";
