"use client";

import { useEffect, useRef, useState } from "react";
import { parseExternalAlbumUrl, type AlbumMediaItem } from "@/lib/album-media";
import "./album-media.css";

export function AlbumMediaView({
  item,
  onPlaybackChange,
  autoPlay = true,
}: {
  item: AlbumMediaItem;
  autoPlay?: boolean;
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [inView, setInView] = useState(false);
  const external =
    item.type === "instagram" || item.type === "tiktok" || item.type === "youtube"
      ? parseExternalAlbumUrl(item.src)
      : null;
  const provider =
    external?.type === "instagram"
      ? "Instagram"
      : external?.type === "youtube"
        ? "YouTube"
        : "TikTok";
  const autoStarting = autoPlay && item.type === "tiktok" && inView && !dismissed;
  const embedOpen = manualOpen || autoStarting;
  let embedSrc = external?.embed;
  if (external?.type === "tiktok") {
    const params = new URLSearchParams({
      autoplay: "1",
      muted: manualOpen ? "0" : "1",
      description: "0",
      music_info: "0",
      rel: "0",
    });
    embedSrc = `${external.embed}?${params}`;
  } else if (external?.type === "youtube") {
    embedSrc = `${external.embed}?autoplay=1&playsinline=1&rel=0`;
  }
  useEffect(() => {
    if (!autoPlay || item.type !== "tiktok" || !figureRef.current) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = false;
    const refresh = () => setInView(intersecting && !motion.matches && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        refresh();
      },
      { threshold: 0 },
    );
    observer.observe(figureRef.current);
    motion.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [autoPlay, item.id, item.type]);
  const externalSrc = external?.src;
  useEffect(() => {
    if (externalSrc && embedOpen) onPlaybackChange?.(true);
    return () => onPlaybackChange?.(false);
  }, [item.id, externalSrc, embedOpen, onPlaybackChange]);
  return (
    <figure ref={figureRef} className={`album-media album-media--${item.orientation}`}>
      {item.type === "image" && (
        <img src={item.src} alt={item.caption || "Dokumentasi kegiatan WAPALA"} loading="lazy" />
      )}
      {item.type === "video" && (
        <video
          src={item.src}
          controls
          playsInline
          preload="metadata"
          aria-label={item.caption || "Video kegiatan WAPALA"}
          onPlay={() => onPlaybackChange?.(true)}
          onPause={() => onPlaybackChange?.(false)}
          onEnded={() => onPlaybackChange?.(false)}
        />
      )}
      {external && (
        <div className={`album-media-embed album-media-embed--${external.type}`}>
          {embedOpen ? (
            <>
              <iframe
                src={embedSrc}
                title={item.caption || `Video ${item.type}`}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="album-embed-actions">
                {autoStarting && !manualOpen && (
                  <button type="button" onClick={() => setManualOpen(true)}>
                    Putar dengan suara
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setManualOpen(false);
                    setDismissed(true);
                  }}
                >
                  Tutup pemutar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="album-embed-load"
              onClick={() => {
                setManualOpen(true);
              }}
            >
              Putar dari {provider}
              <small>Memuat konten dari layanan terkait</small>
            </button>
          )}
          <a href={external.src} target="_blank" rel="noopener noreferrer">
            Buka di {provider}
          </a>
        </div>
      )}
      {item.caption && <figcaption>{item.caption}</figcaption>}
    </figure>
  );
}
