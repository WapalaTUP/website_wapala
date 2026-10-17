"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { date } from "@/lib/content";
import { CONTENT_TAGS, parseContentTags, hasContentTag } from "@/lib/content-tags";
import type { RecordRow } from "@/lib/types";
import { ArticleBody } from "./article-body";
import { Empty, Pagination } from "../ui";
import "../content-rework.css";

export function NewsCard({ post, featured = false }: { post: RecordRow; featured?: boolean }) {
  const p = post.fields;
  return (
    <article className={"news-card" + (featured ? " news-featured" : "")}>
      {p.sampul && (
        <Link href={"/berita/" + p.slug} className="news-card-image">
          <img src={p.sampul} alt={p.judul} width={900} height={600} loading="lazy" />
        </Link>
      )}
      <div>
        <p className="news-eyebrow">
          {parseContentTags(p.tags).join(" · ") || p.kategori || p.tipe}
        </p>
        <h2>
          <Link href={"/berita/" + p.slug}>{p.judul}</Link>
        </h2>
        <p>{p.ringkasan}</p>
        <span className="news-byline">
          {p.penulis && "Oleh " + p.penulis + " · "}
          {date(p.tanggal)}
        </span>
      </div>
    </article>
  );
}
export function NewsPage({
  slug,
  announcement = false,
}: {
  slug?: string;
  announcement?: boolean;
}) {
  const { records } = useDemo();
  const search = useSearchParams();
  const tag = search.get("tag") || "";
  const [page, setPage] = useState(1);
  const [shareMessage, setShareMessage] = useState("");
  const posts = records.konten.filter((p) => !p.archived && p.fields.status === "Publik");
  if (slug) {
    const post = posts.find((p) => p.fields.slug === slug);
    if (!post)
      return (
        <section className="container section">
          <Empty
            title="Konten tidak ditemukan"
            description="Artikel mungkin belum diterbitkan atau sudah diarsipkan."
          />
        </section>
      );
    const p = post.fields,
      tags = parseContentTags(p.tags);
    const related = posts
      .filter((q) => q.id !== post.id && tags.some((t) => hasContentTag(q.fields, t)))
      .slice(0, 3);
    return (
      <article className="news-article">
        <nav className="news-topic-bar" aria-label="Topik berita">
          <Link href="/berita">Kabar WAPALA</Link>
          {CONTENT_TAGS.map((t) => (
            <Link key={t} href={"/berita?tag=" + encodeURIComponent(t)}>
              {t}
            </Link>
          ))}
        </nav>
        <header className="news-article-header">
          <p className="news-eyebrow">
            {p.tipe === "Announcement"
              ? "Pengumuman"
              : tags.join(" · ") || p.kategori || "Kabar WAPALA"}
          </p>
          <h1>{p.judul}</h1>
          {p.ringkasan && <p className="news-deck">{p.ringkasan}</p>}
          <div className="news-article-tools">
            <Link href="/berita">← Semua berita</Link>
            <button
              type="button"
              onClick={async () => {
                try {
                  if (navigator.share)
                    await navigator.share({ title: p.judul, url: window.location.href });
                  else {
                    await navigator.clipboard.writeText(window.location.href);
                    setShareMessage("Tautan disalin.");
                  }
                } catch {
                  setShareMessage("Gunakan alamat halaman untuk membagikan artikel.");
                }
              }}
            >
              Bagikan ↗
            </button>
          </div>
          {shareMessage && <p role="status">{shareMessage}</p>}
        </header>
        {p.sampul && (
          <figure className="news-main-image">
            <img src={p.sampul} alt={p.sampul_caption || p.judul} width={1200} height={800} />
            {(p.sampul_caption || p.sampul_credit) && (
              <figcaption>
                {p.sampul_caption}
                {p.sampul_credit && <span>{p.sampul_credit}</span>}
              </figcaption>
            )}
          </figure>
        )}
        <div className="news-author">
          <strong>Oleh {p.penulis || "WAPALA"}</strong>
          <time dateTime={p.tanggal}>{date(p.tanggal)}</time>
        </div>
        <div className="news-article-body-wrapper">
          <ArticleBody fields={p} />
        </div>
        <footer className="news-article-footer">
          <div className="news-tags">
            {tags.map((t) => (
              <Link key={t} href={"/berita?tag=" + encodeURIComponent(t)}>
                {t}
              </Link>
            ))}
          </div>
        </footer>
        {related.length > 0 && (
          <section className="container section news-related">
            <h2>Berita terkait</h2>
            <div className="news-grid">
              {related.map((q) => (
                <NewsCard key={q.id} post={q} />
              ))}
            </div>
          </section>
        )}
      </article>
    );
  }
  const filtered = posts.filter(
    (p) =>
      (announcement ? p.fields.tipe === "Announcement" : p.fields.tipe === "Berita") &&
      (!tag || hasContentTag(p.fields, tag)),
  );
  const activePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));
  const shown = filtered.slice((activePage - 1) * 6, activePage * 6);
  return (
    <section className="container section news-index">
      <header>
        <p className="news-eyebrow">WAPALA Telkom University</p>
        <h1>{announcement ? "Pengumuman" : "Kabar WAPALA"}</h1>
        <p>Catatan kegiatan, pengetahuan, dan cerita dari lapangan.</p>
      </header>
      <nav className="news-tag-nav" aria-label="Filter tag berita">
        <Link
          className={!tag ? "active" : ""}
          href={announcement ? "/announcement" : "/berita"}
          onClick={() => setPage(1)}
        >
          Semua
        </Link>
        {CONTENT_TAGS.map((t) => (
          <Link
            key={t}
            className={tag === t ? "active" : ""}
            onClick={() => setPage(1)}
            href={(announcement ? "/announcement" : "/berita") + "?tag=" + encodeURIComponent(t)}
          >
            {t}
          </Link>
        ))}
      </nav>
      {shown.length ? (
        <>
          <div className="news-lead-layout">
            <NewsCard post={shown[0]} featured />
            {shown[1] && <NewsCard post={shown[1]} />}
          </div>
          {shown.length > 2 && (
            <div className="news-grid">
              {shown.slice(2).map((p) => (
                <NewsCard key={p.id} post={p} />
              ))}
            </div>
          )}
          <Pagination page={activePage} total={filtered.length} onChange={setPage} />
        </>
      ) : (
        <Empty
          title={tag ? "Belum ada berita bertag " + tag : "Belum ada berita"}
          description="Tulisan yang sudah diterbitkan akan muncul di sini."
        />
      )}
    </section>
  );
}
