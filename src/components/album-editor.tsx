"use client";

import { useState } from "react";
import {
  parseAlbumMedia,
  parseExternalAlbumUrl,
  mediaOrientation,
  type AlbumFields,
  type AlbumMediaItem,
} from "@/lib/album-media";
import { uploadMediaDetails } from "@/components/backend/api";
import { AlbumMediaView } from "./album-media";
import "./album-media.css";

export function AlbumMediaEditor({
  fields,
  onChange,
  csrfToken,
  onBusyChange,
}: {
  fields: AlbumFields;
  onChange: (fields: AlbumFields) => void;
  csrfToken: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const items = parseAlbumMedia(fields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  function save(
    next: AlbumMediaItem[],
    featured = typeof fields.featured_media === "string" ? fields.featured_media : "",
  ) {
    onChange({
      ...fields,
      media_items: JSON.stringify(next),
      featured_media: next.some((item) => item.id === featured) ? featured : next[0]?.id || "",
    });
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    if (items.length + files.length > 500) {
      setError("Album maksimal 500 media.");
      return;
    }
    const chosen = Array.from(files);
    const videoMimes = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];
    if (
      chosen.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp", ...videoMimes].includes(file.type) ||
          file.size > (videoMimes.includes(file.type) ? 50 : 5) * 1024 * 1024,
      )
    ) {
      setError(
        "Gunakan foto JPG/PNG/WebP maksimal 5 MB atau video MP4/MOV/WebM/MKV maksimal 50 MB.",
      );
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    const next = [...items];
    try {
      for (const file of chosen) {
        const video = videoMimes.includes(file.type);
        const uploaded = await uploadMediaDetails(
          file,
          video ? "content-video" : "content",
          csrfToken,
        );
        next.push({
          id: crypto.randomUUID(),
          type: video ? "video" : "image",
          src: uploaded.url,
          caption: "",
          orientation: mediaOrientation(uploaded.width, uploaded.height),
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unggahan gagal.");
    } finally {
      if (next.length > items.length) save(next);
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  function addExternal() {
    const external = parseExternalAlbumUrl(url.trim());
    if (!external) {
      setError("Masukkan tautan posting/reel Instagram, video TikTok lengkap, atau video YouTube.");
      return;
    }
    if (items.length >= 500) {
      setError("Album maksimal 500 media.");
      return;
    }
    save([
      ...items,
      {
        id: crypto.randomUUID(),
        type: external.type,
        src: external.src,
        caption: "",
        orientation:
          external.type === "youtube" && !url.includes("/shorts/") ? "landscape" : "portrait",
      },
    ]);
    setUrl("");
    setError("");
  }
  function update(id: string, patch: Partial<AlbumMediaItem>) {
    save(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  function move(index: number, direction: number) {
    const next = [...items],
      destination = index + direction;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    save(next);
  }
  return (
    <fieldset className="album-editor" disabled={busy}>
      <legend>Media album</legend>
      <p>
        Susun foto, video MP4, serta tautan Instagram/TikTok/YouTube. Tag berlaku untuk seluruh
        album.
      </p>
      <label>
        Unggah foto atau video
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,video/x-matroska"
          multiple
          onChange={(event) => {
            void upload(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <small>Foto maksimal 5 MB. Video MP4 H.264/H.265 maksimal 50 MB, 20 menit, dan 4K.</small>
      <div className="album-editor-link">
        <label>
          Tautan Instagram / TikTok / YouTube
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <button type="button" onClick={addExternal}>
          Tambah tautan
        </button>
      </div>
      {busy && <p role="status">Mengunggah dan memeriksa keamanan media…</p>}
      {error && <p role="alert">{error}</p>}
      <ol className="album-editor-items">
        {items.map((item, index) => (
          <li key={item.id}>
            <AlbumMediaView item={item} autoPlay={false} />
            <div className="album-editor-controls">
              <strong>
                Media {index + 1} · {item.type}
              </strong>
              <label>
                Keterangan
                <input
                  value={item.caption}
                  maxLength={500}
                  onChange={(event) => update(item.id, { caption: event.target.value })}
                />
              </label>
              <label>
                Orientasi
                <select
                  value={item.orientation}
                  onChange={(event) =>
                    update(item.id, {
                      orientation: event.target.value as AlbumMediaItem["orientation"],
                    })
                  }
                >
                  <option value="landscape">Lanskap</option>
                  <option value="portrait">Potret</option>
                </select>
              </label>
              <label>
                <input
                  type="radio"
                  name="album-featured-media"
                  checked={(fields.featured_media || items[0]?.id) === item.id}
                  onChange={() => save(items, item.id)}
                />
                Media utama
              </label>
              <div className="album-editor-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Pindahkan media ${index + 1} ke atas`}
                >
                  Naik
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Pindahkan media ${index + 1} ke bawah`}
                >
                  Turun
                </button>
                <button
                  type="button"
                  onClick={() => save(items.filter((media) => media.id !== item.id))}
                >
                  Hapus
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
