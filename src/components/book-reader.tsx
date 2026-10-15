"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { visibleBookPages, nextBookPage } from "@/lib/reader-pages";
import type { PDFDocumentProxy } from "pdfjs-dist";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Empty, Notice } from "./ui";
import { EpubReader } from "./epub-reader";
export function BookReader({ id }: { id: string }) {
  const [book, setBook] = useState<{
    title: string;
    url: string;
    mime: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [outline, setOutline] = useState<{ title: string; page: number }[]>([]);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const [two, setTwo] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const pages = useMemo(
    () => visibleBookPages(page, doc?.numPages || 0, two),
    [page, doc, two],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/books/" + encodeURIComponent(id), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Buku belum tersedia.");
        const value = await response.json();
        if (!controller.signal.aborted) setBook(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Buku belum tersedia.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);
  useEffect(() => {
    const media = matchMedia("(min-width: 901px)");
    const resize = () => setTwo(media.matches);
    resize();
    media.addEventListener("change", resize);
    const observer = new ResizeObserver(([entry]) =>
      setStageWidth(Math.floor(entry.contentRect.width)),
    );
    if (stage.current) observer.observe(stage.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", resize);
    };
  }, [book]);
  useEffect(() => {
    let stop = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        if (!book || book.mime !== "application/pdf") return;
        const pdf = await import("pdfjs-dist");
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdf.getDocument({
          url: book.url,
          disableAutoFetch: true,
          disableStream: true,
        });
        destroy = () => {
          void task.destroy();
        };
        const loaded = await task.promise;
        if (loaded.numPages > 2000) {
          await task.destroy();
          throw new Error("Buku melebihi batas 2.000 halaman.");
        }
        if (stop) return;
        setDoc(loaded);
        const tree = await loaded.getOutline();
        if (tree) {
          const list = [];
          for (const item of tree.slice(0, 30)) {
            const dest =
              typeof item.dest === "string"
                ? await loaded.getDestination(item.dest)
                : item.dest;
            let p = 1;
            if (dest && typeof dest[0] === "object")
              p = (await loaded.getPageIndex(dest[0])) + 1;
            list.push({ title: item.title, page: p });
          }
          if (!stop) setOutline(list);
        }
      } catch {
        if (!stop)
          setError(
            "Buku belum dapat dimuat. Periksa koneksi atau coba kembali.",
          );
      }
    })();
    return () => {
      stop = true;
      destroy?.();
    };
  }, [book]);
  useEffect(() => {
    let cancelled = false;
    const tasks: { cancel: () => void; promise: Promise<void> }[] = [];
    if (!doc || stageWidth < 1) return;
    void Promise.all(
      pages.map(async (number, index) => {
        try {
          const p = await doc.getPage(number);
          const target = canvases.current[index];
          if (cancelled || !target) return;
          const base = p.getViewport({ scale: 1 });
          const width = Math.min(two ? 520 : 820, stageWidth / (two ? 2 : 1));
          const density = Math.min(window.devicePixelRatio || 1, 1.75);
          const view = p.getViewport({
            scale: (width / base.width) * zoom * density,
          });
          target.width = Math.ceil(view.width);
          target.height = Math.ceil(view.height);
          target.style.width = view.width / density + "px";
          target.style.height = view.height / density + "px";
          const task = p.render({ canvas: target, viewport: view });
          tasks.push(task);
          await task.promise;
        } catch (e) {
          if (
            !cancelled &&
            !(e instanceof Error && e.name === "RenderingCancelledException")
          )
            setError("Halaman belum dapat ditampilkan.");
        }
      }),
    );
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [doc, pages, zoom, two, stageWidth]);
  if (loading)
    return (
      <div className="container section reader-loading">
        Memuat bahan bacaan…
      </div>
    );
  if (!book)
    return (
      <div className="container section">
        <Empty
          title="Buku tidak ditemukan"
          description={error || "Pilih bahan bacaan yang tersedia."}
          action={
            <Link className="btn secondary" href="/buku">
              Kembali ke buku
            </Link>
          }
        />
      </div>
    );
  if (book.mime === "application/epub+zip")
    return <EpubReader title={book.title} url={book.url} />;
  return (
    <section className="book-reader">
      <div className="container">
        <div className="reader-toolbar">
          <h2>{book.title}</h2>
          <div className="reader-controls">
            <button
              className="icon-btn"
              disabled={page <= 1}
              onClick={() =>
                setPage(nextBookPage(page, doc?.numPages || 1, two, -1))
              }
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft />
            </button>
            <label>
              Halaman{" "}
              <input
                aria-label="Nomor halaman"
                type="number"
                min={1}
                max={doc?.numPages || 1}
                value={page}
                onChange={(e) =>
                  setPage(
                    Math.max(
                      1,
                      Math.min(doc?.numPages || 1, Number(e.target.value) || 1),
                    ),
                  )
                }
              />
            </label>
            <span>/ {doc?.numPages || "…"}</span>
            <button
              className="icon-btn"
              disabled={!doc || (pages.at(-1) || 1) >= doc.numPages}
              onClick={() =>
                setPage(nextBookPage(page, doc?.numPages || 1, two, 1))
              }
              aria-label="Halaman berikutnya"
            >
              <ChevronRight />
            </button>
            <select
              aria-label="Zoom buku"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              {[0.75, 1, 1.25, 1.5].map((z) => (
                <option value={z} key={z}>
                  {z * 100}%
                </option>
              ))}
            </select>
            <Link className="btn secondary" href="/buku">
              Tutup buku
            </Link>
          </div>
        </div>
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div className="reader-layout">
            <aside className="reader-toc">
              <h3>Daftar isi</h3>
              <p className="reader-page-range">
                {two ? "Dua halaman" : "Satu halaman"}
              </p>
              {outline.length ? (
                outline.map((n, i) => (
                  <button key={i} onClick={() => setPage(n.page)}>
                    {n.title}
                  </button>
                ))
              ) : (
                <p className="field-hint">
                  Gunakan kontrol halaman untuk menelusuri buku ini.
                </p>
              )}
            </aside>
            <div
              className="reader-canvas book-stage"
              ref={stage}
              tabIndex={0}
              aria-label="Area baca buku"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setPage((p) => nextBookPage(p, doc?.numPages || 1, two, 1));
                }
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setPage((p) => nextBookPage(p, doc?.numPages || 1, two, -1));
                }
              }}
            >
              {!doc && (
                <div className="reader-loading">Memuat bahan bacaan…</div>
              )}
              <div
                className={"book-spread" + (two ? " is-double" : "")}
                aria-live="polite"
              >
                {pages.map((number, index) => (
                  <figure className="book-sheet" key={number}>
                    <canvas
                      ref={(element) => {
                        canvases.current[index] = element;
                      }}
                      role="img"
                      aria-label={book.title + ", halaman " + number}
                    />
                    <figcaption>{number}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
