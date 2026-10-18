"use client";

import { useEffect, useRef, useState } from "react";
import { parseExternalAlbumUrl, type AlbumMediaItem } from "@/lib/album-media";
import { albumPlaybackEmbed, playAlbumVideo } from "@/lib/album-autoplay";
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
  const playerRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const autoStarting = autoPlay && !!external && inView && !dismissed;
  const embedOpen = manualOpen || autoStarting;
  const embedSrc = external ? albumPlaybackEmbed(item.src) : undefined;
  useEffect(() => {
    if (!autoPlay || item.type === "image" || !figureRef.current) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intersecting = false;
    const refresh = () => {
      setInView(intersecting && !motion.matches && !document.hidden);
      if (!intersecting || document.hidden) {
        setManualOpen(false);
        videoRef.current?.pause();
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        refresh();
      },
      { threshold: [0, 0.25] },
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
  useEffect(() => {
    const video = videoRef.current;
    if (item.type !== "video" || !video) return;
    let active = autoPlay && inView;
    if (active) void playAlbumVideo(video, () => active);
    else video.pause();
    return () => {
      active = false;
      video.pause();
    };
  }, [autoPlay, inView, item.id, item.src, item.type]);
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
          ref={videoRef}
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
                ref={playerRef}
                src={embedSrc}
                title={item.caption || `Video ${item.type}`}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="album-embed-actions">
                {autoStarting && !manualOpen && external.type === "tiktok" && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualOpen(true);
                      for (const type of ["unMute", "play"]) {
                        playerRef.current?.contentWindow?.postMessage(
                          { type, "x-tiktok-player": true },
                          "https://www.tiktok.com",
                        );
                      }
                    }}
                  >
                    Putar video
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
          {embedOpen && external.type === "instagram" && (
            <small>Ketuk Play pada pemutar Instagram untuk memulai video dengan suara.</small>
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
