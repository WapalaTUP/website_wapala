"use client";
import { useEffect, useRef, useState } from "react";
import { Notice } from "./ui";
type Context = { csrfToken: string };
export function usePublicTransport() {
  const [context, setContext] = useState<Context | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    fetch("/api/public/forms/context", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Layanan belum tersedia.");
        if (active) setContext(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function post<T>(action: string, data: Record<string, unknown> | FormData): Promise<T> {
    if (inFlight.current) throw Error("Permintaan masih diproses.");
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      // Refresh before sending, including after another tab renews the cookie.
      const contextResponse = await fetch("/api/public/forms/context", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const freshContext = await contextResponse.json();
      if (!contextResponse.ok) throw Error(freshContext.error || "Layanan formulir belum siap.");
      setContext(freshContext);
      const multipart = data instanceof FormData;
      const r = await fetch("/api/public/forms/" + action, {
        method: "POST",
        headers: {
          "x-csrf-token": freshContext.csrfToken,
          ...(!multipart ? { "content-type": "application/json" } : {}),
        },
        body: multipart ? data : JSON.stringify(data),
      });
      if (action === "invoice" && r.ok) return (await r.blob()) as T;
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Permintaan belum dapat diproses.");
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Layanan belum tersedia.");
      throw e;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return {
    context,
    busy,
    error,
    setError,
    post,
  };
}
export type PublicTransport = ReturnType<typeof usePublicTransport>;
export function PublicUpload({
  label,
  purpose,
  scope,
  transport: t,
  onUploaded,
}: {
  label: string;
  purpose: "applicant-photo" | "donation-proof";
  scope: string;
  transport: PublicTransport;
  onUploaded: (url: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState("");
  return (
    <div className="field">
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={t.busy}
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            if (selected && selected.size > 5 * 1024 * 1024) {
              t.setError("Foto maksimal 5 MB.");
              setFile(null);
              return;
            }
            setFile(selected);
          }}
        />
      </label>
      <button
        type="button"
        className="btn secondary"
        disabled={!file || t.busy}
        onClick={async () => {
          if (!file) return;
          const data = new FormData();
          data.set("file", file);
          data.set("purpose", purpose);
          data.set("scope", scope);
          try {
            const uploaded = await t.post<{ url: string }>("uploads", data);
            onUploaded(uploaded.url);
            setName(file.name);
            setFile(null);
          } catch {}
        }}
      >
        Unggah {label.toLowerCase()}
      </button>
      {name && <p role="status">Tersimpan: {name}</p>}
      <p className="field-hint">JPG / PNG / WebP · maksimal 5 MB.</p>
      {t.error && <Notice tone="error">{t.error}</Notice>}
    </div>
  );
}
