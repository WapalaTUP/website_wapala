"use client";
import Link from "next/link";
import { divisions } from "@/lib/content";
import { divisionGuides } from "@/lib/division-guides";
import { hasContentTag } from "@/lib/content-tags";
import { getPublicAlbums } from "@/lib/gallery";
import { useDemo } from "@/lib/store";
import { PageIntro } from "./page-intro";
import { NewsCard } from "./articles/news-page";
import "./content-rework.css";

export function DivisionPage({ slug }: { slug?: string }) {
  const state = useDemo();
  const selected = divisions.find((d) => d.slug === slug);
  if (!selected)
    return (
      <>
        <PageIntro
          title={"Alam adalah\nruang belajar kita."}
          description="Empat divisi, banyak cara untuk mengenal alam dan belajar bersama."
        />
        <section className="container section division-overview">
          {divisions.map((d, i) => {
            const image =
              [
                state.settings.divisionImageUrl1,
                state.settings.divisionImageUrl2,
                state.settings.divisionImageUrl3,
                state.settings.divisionImageUrl4,
              ][i] || state.settings.divisionImageUrl;
            return (
              <Link href={"/divisi/" + d.slug} key={d.slug} className="division-overview-card">
                {image && <img src={image} alt={d.name} loading="lazy" />}
                <span>0{i + 1}</span>
                <h2>{d.name}</h2>
                <p>{d.description}</p>
                <span>Kenali divisi →</span>
              </Link>
            );
          })}
        </section>
      </>
    );
  const guide = divisionGuides[selected.slug];
  const index = divisions.indexOf(selected);
  const image =
    [
      state.settings.divisionImageUrl1,
      state.settings.divisionImageUrl2,
      state.settings.divisionImageUrl3,
      state.settings.divisionImageUrl4,
    ][index] || state.settings.divisionImageUrl;
  const posts = state.records.konten.filter(
    (p) => !p.archived && p.fields.status === "Publik" && hasContentTag(p.fields, selected.name),
  );
  const albums = getPublicAlbums(state.records.galeri, !state.backend).filter((a) =>
    a.tags?.includes(selected.name),
  );
  return (
    <>
      <section className="container section division-intro">
        <div>
          <Link href="/divisi" className="text-link">
            ← Semua divisi
          </Link>
          <p className="division-kicker">Ruang belajar WAPALA</p>
          <h1>{selected.name}</h1>
          <p className="lead">{selected.description}</p>
          <p>{guide.intro}</p>
          <a href="#cerita-divisi" className="text-link">
            Jelajahi kegiatan ↓
          </a>
        </div>
        {image && (
          <figure>
            <img src={image} alt={"Kegiatan " + selected.name} />
          </figure>
        )}
      </section>
      <section className="container section division-learning">
        <div>
          <p className="division-kicker">Pengetahuan bertemu pengalaman</p>
          <h2>Yang kita pelajari.</h2>
          <p>
            Persiapan, latihan bersama, dan pengalaman lapangan membentuk proses belajar divisi.
          </p>
        </div>
        <div className="division-topics">
          {guide.topics.map((topic, i) => (
            <article key={topic.title}>
              <span>0{i + 1}</span>
              <h3>{topic.title}</h3>
              <p>{topic.description}</p>
            </article>
          ))}
        </div>
        <p className="division-source">
          Bahan pengenalan:{" "}
          <a href={guide.source} target="_blank" rel="noopener noreferrer">
            {guide.book} WAPALA ↗
          </a>
        </p>
      </section>
      <div id="cerita-divisi">
        {posts.length > 0 && (
          <section className="container section">
            <div className="section-heading">
              <h2>Cerita dari lapangan.</h2>
              <Link href={"/berita?tag=" + encodeURIComponent(selected.name)} className="text-link">
                Semua berita →
              </Link>
            </div>
            <div className="news-grid">
              {posts.slice(0, 3).map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}
        {albums.length > 0 && (
          <section className="container section">
            <div className="section-heading">
              <h2>Jejak kegiatan.</h2>
              <Link href={"/galeri?tag=" + encodeURIComponent(selected.name)} className="text-link">
                Semua album →
              </Link>
            </div>
            <div className="album-grid">
              {albums.slice(0, 3).map((album) => (
                <Link className="album-card" href={"/galeri/" + album.id} key={album.id}>
                  {album.image && <img src={album.image} alt={album.title} loading="lazy" />}
                  <div>
                    <p>{album.location}</p>
                    <h3>{album.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <section className="container section division-next">
        <h2>Terus belajar, bersama.</h2>
        <p>Kenali kegiatan terbuka dan cerita terbaru dari WAPALA.</p>
        <div className="button-row">
          <Link href="/event" className="btn primary">
            Lihat kegiatan
          </Link>
          <Link href="/divisi" className="btn secondary">
            Jelajahi divisi lainnya
          </Link>
        </div>
      </section>
    </>
  );
}
