"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { useDemo } from "@/lib/store";
import { Modal } from "./ui";
import {
  albumDate,
  getPublicAlbums,
  getHeroGalleryPhotos,
  canAutoplaySlideshow,
} from "@/lib/gallery";

export function HeroGallery() {
  const state = useDemo();
  const source = useMemo(
    () =>
      getHeroGalleryPhotos(
        getPublicAlbums(state.records.galeri, !state.backend),
      ),
    [state.records.galeri, state.backend],
  );
  const [fullPhoto, setFullPhoto] = useState<(typeof source)[number] | null>(
    null,
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [explicitPlay, setExplicitPlay] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  const [onScreen, setOnScreen] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.05 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    motion();
    visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const photo = source[index % (source.length || 1)];
  const current = photo?.album;
  const previews = Array.from(
    { length: Math.min(5, source.length) },
    (_, offset) => ({
      ...source[(index + offset) % source.length],
      index: (index + offset) % source.length,
      active: offset === 0,
    }),
  );
  const playing = canAutoplaySlideshow({
    paused,
    hovered,
    focused,
    reduced,
    visible: visible && onScreen,
    modalOpen: Boolean(fullPhoto),
    explicitPlay,
  });
  useEffect(() => {
    if (!playing || source.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % source.length),
      5000,
    );
    return () => clearInterval(timer);
  }, [playing, source.length]);
  const move = (direction: number) => {
    setIndex((i) => (i + direction + source.length) % source.length);
    setPaused(true);
  };
  return (
    <section
      ref={sectionRef}
      className="hero gallery-hero"
      aria-label="Album kegiatan WAPALA"
      aria-roledescription="carousel"
      onMouseEnter={() => {
        setHovered(true);
        setExplicitPlay(false);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => {
        setFocused(true);
        setExplicitPlay(false);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className="hero-photo hero-gallery-rail">
        {previews.map((p, slot) => (
          <button
            key={slot}
            className={
              "hero-photo-cell hero-gallery-tile" +
              (p.active ? " is-active" : "")
            }
            aria-label={
              p.active
                ? "Lihat foto penuh: " + p.album.title
                : "Tampilkan foto " + (p.index + 1) + ": " + p.album.title
            }
            aria-current={p.active ? "true" : undefined}
            onClick={() => {
              if (p.active) {
                setFullPhoto(p);
                setPaused(true);
              } else {
                setIndex(p.index);
                setPaused(true);
              }
            }}
          >
            <Image
              key={p.image}
              className={p.active ? "hero-slide-image" : "hero-preview-image"}
              src={p.image}
              alt={p.active ? p.album.title : ""}
              fill
              loading={p.active || slot === 1 ? "eager" : "lazy"}
              fetchPriority={p.active ? "high" : "low"}
              decoding="async"
              sizes={
                p.active || slot === 1
                  ? "(max-width: 760px) 90vw, 38vw"
                  : "(max-width: 760px) 20vw, 5vw"
              }
            />
            <span className="hero-tile-marker">
              {p.active ? "Lihat foto" : p.index + 1}
            </span>
          </button>
        ))}
      </div>
      <div className="hero-shade" />
      <div className="container hero-content">
        <p className="hero-organization">
          Wahana Pencinta Alam
          <br />
          Telkom University
        </p>
        <h1>
          Hamemayu
          <br />
          Hayuning Bawana.
        </h1>
        <p className="hero-description">
          Mempercantik alam yang sudah cantik.
          <br />
          Bersama merawat ruang hidup sejak 2004.
        </p>
        <div className="button-row">
          <Link className="btn white" href="/profil">
            Kenali WAPALA
            <ArrowUpRight size={18} />
          </Link>
          <Link className="hero-link" href="/galeri">
            Lihat perjalanan kami
          </Link>
        </div>
      </div>
      <div className="container hero-album-panel">
        <div
          className="hero-album-copy"
          aria-live={playing ? "off" : "polite"}
          aria-atomic="true"
        >
          {current ? (
            <>
              <span className="hero-highlight-label">
                {photo.highlight ? "Highlight pilihan WAPALA" : "Foto terbaru"}
              </span>
              <Link href={"/galeri/" + current.id} className="hero-album-title">
                {current.title}
                <ArrowUpRight size={18} />
              </Link>
              <p>{current.description}</p>
              <time
                dateTime={
                  current.activityDate || current.uploadedAt || undefined
                }
              >
                {albumDate(current)}
              </time>
            </>
          ) : (
            <p>Dokumentasi kegiatan segera hadir.</p>
          )}
        </div>
        {source.length > 1 && (
          <div className="hero-controls">
            <span>
              {(index % source.length) + 1} / {source.length} foto
            </span>
            <button
              className="hero-control"
              aria-label="Album sebelumnya"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="hero-control"
              aria-label={paused ? "Putar slideshow" : "Jeda slideshow"}
              aria-pressed={paused}
              disabled={reduced}
              title={
                reduced
                  ? "Pergantian otomatis dinonaktifkan mengikuti pengaturan gerakan perangkat"
                  : undefined
              }
              onClick={() => {
                setPaused(!paused);
                setExplicitPlay(paused);
              }}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              className="hero-control"
              aria-label="Album berikutnya"
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
      <Modal
        open={Boolean(fullPhoto)}
        title={fullPhoto?.album.title || "Dokumentasi WAPALA"}
        onClose={() => setFullPhoto(null)}
      >
        {fullPhoto && (
          <figure>
            <img
              src={fullPhoto.image}
              alt={fullPhoto.album.title}
              width={1200}
              height={900}
              className="hero-full-photo"
            />
            <figcaption>
              {fullPhoto.album.description}
              <br />
              {albumDate(fullPhoto.album)}
            </figcaption>
          </figure>
        )}
      </Modal>
    </section>
  );
}
