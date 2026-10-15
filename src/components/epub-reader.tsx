"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Book, Rendition } from "epubjs";
import { Notice } from "./ui";
export function EpubReader({ title, url }: { title: string; url: string }) {
  const target = useRef<HTMLDivElement>(null),
    rendition = useRef<Rendition | null>(null);
  const [error, setError] = useState(""),
    [toc, setToc] = useState<Array<{ label: string; href: string }>>([]),
    [location, setLocation] = useState("");
  useEffect(() => {
    let stopped = false,
      book: Book | undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Buku belum tersedia.");
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 50 * 1024 * 1024)
          throw new Error("Buku melebihi batas ukuran.");
        const { default: ePub } = await import("epubjs");
        if (stopped || !target.current) return;
        book = ePub(bytes);
        await book.ready;
        if (stopped) return;
        const navigation = await book.loaded.navigation;
        if (!stopped)
          setToc(
            navigation.toc
              .slice(0, 200)
              .map((n) => ({ label: n.label, href: n.href })),
          );
        const view = book.renderTo(target.current, {
          width: "100%",
          height: 650,
          spread: "auto",
          allowScriptedContent: false,
        });
        rendition.current = view;
        view.on(
          "relocated",
          (value: {
            start: { displayed: { page: number; total: number } };
          }) => {
            if (!stopped)
              setLocation(
                "Halaman bagian " +
                  value.start.displayed.page +
                  " / " +
                  value.start.displayed.total,
              );
          },
        );
        await view.display();
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "EPUB belum dapat dibuka.");
      }
    })();
    return () => {
      stopped = true;
      controller.abort();
      rendition.current?.destroy();
      rendition.current = null;
      book?.destroy();
    };
  }, [url]);
  const move = (href?: string, direction?: number) => {
    const view = rendition.current;
    if (!view) return;
    void (
      href ? view.display(href) : direction === -1 ? view.prev() : view.next()
    ).catch(() => setError("Halaman belum dapat ditampilkan."));
  };
  return (
    <section className="book-reader">
      <div className="container">
        <div className="reader-toolbar">
          <h2>{title}</h2>
          <div className="reader-controls">
            <button
              className="btn secondary"
              onClick={() => move(undefined, -1)}
            >
              Sebelumnya
            </button>
            <span>{location}</span>
            <button
              className="btn secondary"
              onClick={() => move(undefined, 1)}
            >
              Berikutnya
            </button>
            <Link className="btn secondary" href="/buku">
              Tutup buku
            </Link>
          </div>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="reader-layout">
          <aside className="reader-toc">
            <h3>Daftar isi</h3>
            {toc.map((n, i) => (
              <button key={i} onClick={() => move(n.href)}>
                {n.label}
              </button>
            ))}
          </aside>
          <div
            className="reader-canvas"
            ref={target}
            aria-label="Area baca EPUB"
          />
        </div>
      </div>
    </section>
  );
}
