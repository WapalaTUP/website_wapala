"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useDemo } from "@/lib/store";
import { getPublicAlbums, getCategoryGalleryPhotos } from "@/lib/gallery";
export function CategoryGallery() {
  const state = useDemo();
  const source = useMemo(
    () =>
      getCategoryGalleryPhotos(
        getPublicAlbums(state.records.galeri, !state.backend),
      ),
    [state.records.galeri, state.backend],
  );
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [active, setActive] = useState(false),
    [reduced, setReduced] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    motion();
    media.addEventListener("change", motion);
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (!active || paused || reduced || source.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % source.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, paused, reduced, source.length]);
  const move = (delta: number) => {
    setIndex((i) => (i + delta + source.length) % source.length);
    setPaused(true);
  };
  return (
    <div
      className="gallery-feature-photos category-gallery-photos"
      ref={ref}
      aria-label="Momen terbaru dari lima kategori"
      aria-roledescription="carousel"
    >
      {[0, 1].map((offset) => {
        const p = source[(index + offset) % source.length];
        return (
          p && (
            <Link
              key={offset}
              className="category-gallery-photo"
              href={"/galeri/" + p.album.id}
              onFocus={() => setPaused(true)}
            >
              <Image
                key={p.image}
                src={p.image}
                alt={p.album.title}
                fill
                sizes="(max-width: 760px) 45vw, 27vw"
                loading="lazy"
              />
              <span>{p.album.category}</span>
            </Link>
          )
        );
      })}
      {source.length > 1 && (
        <div className="category-gallery-controls">
          <span>
            {(index % source.length) + 1} / {source.length} kategori
          </span>
          <button
            className="icon-btn"
            aria-label="Momen sebelumnya"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label={paused ? "Putar momen galeri" : "Jeda momen galeri"}
            disabled={reduced}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            className="icon-btn"
            aria-label="Momen berikutnya"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
