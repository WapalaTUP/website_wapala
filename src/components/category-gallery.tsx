"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useDemo } from "@/lib/store";
import { getPublicAlbums, getCategoryGalleryPhotos } from "@/lib/gallery";
import { AlbumMediaView } from "./album-media";
import { momentPanelCount } from "@/lib/featured-moments";
import "./featured-moments.css";
export function CategoryGallery() {
  const state = useDemo();
  const source = useMemo(() => {
    const albums = getPublicAlbums(state.records.galeri, !state.backend);
    const pinned = albums.filter((album) => album.highlight);
    return pinned.length
      ? pinned.map((album) => ({ album, image: album.image, order: 0 }))
      : getCategoryGalleryPhotos(albums);
  }, [state.records.galeri, state.backend]);
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [active, setActive] = useState(false),
    [reduced, setReduced] = useState(true),
    [playing, setPlaying] = useState(false);
  const playbackChange = useCallback((value: boolean) => setPlaying(value), []);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    motion();
    media.addEventListener("change", motion);
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
      threshold: 0.1,
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (!active || paused || playing || reduced || source.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % source.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, paused, playing, reduced, source.length]);
  const move = (delta: number) => {
    setIndex((i) => (i + delta + source.length) % source.length);
    setPaused(true);
  };
  return (
    <div
      className={
        "gallery-feature-photos category-gallery-photos" +
        (momentPanelCount(source[index % source.length]?.album.featuredMedia) === 1
          ? " moment-wide"
          : "")
      }
      ref={ref}
      aria-label="Momen pilihan dari album WAPALA"
      aria-roledescription="carousel"
    >
      {Array.from(
        {
          length: Math.min(
            source.length,
            momentPanelCount(source[index % source.length]?.album.featuredMedia),
          ),
        },
        (_, offset) => {
          const p = source[(index + offset) % source.length];
          const media = p.album.featuredMedia;
          return (
            <div
              key={p.album.id + "-" + offset}
              className="category-gallery-photo moment-panel"
              onFocus={() => setPaused(true)}
            >
              {media && media.type !== "image" ? (
                <AlbumMediaView
                  key={media.id}
                  item={media}
                  autoPlay={offset === 0}
                  onPlaybackChange={playbackChange}
                />
              ) : (
                <Link className="moment-image" href={"/galeri/" + p.album.id}>
                  <Image
                    src={media?.src || p.image}
                    alt={p.album.title}
                    fill
                    sizes="(max-width:760px) 90vw, 30vw"
                    loading="lazy"
                  />
                </Link>
              )}
              <Link className="moment-album-label" href={"/galeri/" + p.album.id}>
                {p.album.title} ↗
              </Link>
            </div>
          );
        },
      )}
      {source.length > 1 && (
        <div className="category-gallery-controls">
          <span>
            {(index % source.length) + 1} / {source.length} album
          </span>
          <button className="icon-btn" aria-label="Momen sebelumnya" onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label={paused ? "Putar momen galeri" : "Jeda momen galeri"}
            disabled={reduced || playing}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button className="icon-btn" aria-label="Momen berikutnya" onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
