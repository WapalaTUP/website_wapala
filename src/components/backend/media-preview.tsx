"use client";
import { useState } from "react";

export function MediaPreview({ src, label }: { src?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || !/^\/api\/media\/[a-f0-9-]{36}$/.test(src))
    return <p>{label}: belum tersedia.</p>;
  return (
    <figure style={{ margin: "16px 0" }}>
      {!failed && (
        <img
          src={src}
          alt={label}
          width={640}
          height={480}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: 360,
            objectFit: "contain",
            borderRadius: 8,
          }}
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>
        <a className="text-link" href={src} target="_blank" rel="noreferrer">
          {failed ? "Buka berkas " : "Lihat ukuran penuh: "}
          {label}
        </a>
      </figcaption>
    </figure>
  );
}
