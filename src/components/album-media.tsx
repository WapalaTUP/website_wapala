"use client";

import { useEffect, useState } from "react";
import { parseExternalAlbumUrl, type AlbumMediaItem } from "@/lib/album-media";
import "./album-media.css";

export function AlbumMediaView({
  item,
  onPlaybackChange,
}: {
  item: AlbumMediaItem;
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const [embedOpen, setEmbedOpen] = useState(false);
  const external =
    item.type === "instagram" || item.type === "tiktok" ? parseExternalAlbumUrl(item.src) : null;
  useEffect(() => () => onPlaybackChange?.(false), [item.id, onPlaybackChange]);
  return (
    <figure className={`album-media album-media--${item.orientation}`}>
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
        <div className="album-media-embed">
          {embedOpen ? (
            <>
              <iframe
                src={external.embed}
                title={item.caption || `Video ${item.type}`}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                allow="fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => {
                  setEmbedOpen(false);
                  onPlaybackChange?.(false);
                }}
              >
                Tutup pemutar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="album-embed-load"
              onClick={() => {
                setEmbedOpen(true);
                onPlaybackChange?.(true);
              }}
            >
              Putar dari {item.type === "instagram" ? "Instagram" : "TikTok"}
              <small>Memuat konten dari layanan terkait</small>
            </button>
          )}
          <a href={external.src} target="_blank" rel="noopener noreferrer">
            Buka di {item.type === "instagram" ? "Instagram" : "TikTok"}
          </a>
        </div>
      )}
      {item.caption && <figcaption>{item.caption}</figcaption>}
    </figure>
  );
}
