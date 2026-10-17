"use client";
import { useCallback, useEffect, useState } from "react";
import { backendApi } from "./api";

export type ManagedTag = { id: string; name: string; slug: string; usage: number };

export function useManagedTags(csrfToken: string) {
  const [tags, setTags] = useState<ManagedTag[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const data = await backendApi<{ tags: ManagedTag[] }>("/api/admin/tags", csrfToken);
      setTags(data.tags);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat tag.");
    }
  }, [csrfToken]);
  useEffect(() => {
    let alive = true;
    backendApi<{ tags: ManagedTag[] }>("/api/admin/tags", csrfToken)
      .then((data) => {
        if (alive) setTags(data.tags);
      })
      .catch(() => {
        // Gagal muat (mis. tanpa izin) biarkan kosong — picker menyesuaikan.
      });
    return () => {
      alive = false;
    };
  }, [csrfToken]);
  return { tags, error, setError, refresh };
}

type TagPickerProps = {
  tags: ManagedTag[];
  selected: string[];
  onChange: (next: string[]) => void;
  onCreated: () => void;
  csrfToken: string;
  allowCreate?: boolean;
};

export function TagPicker({
  tags,
  selected,
  onChange,
  onCreated,
  csrfToken,
  allowCreate = true,
}: TagPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (tag: string, checked: boolean) =>
    onChange(checked ? [...selected, tag] : selected.filter((entry) => entry !== tag));
  return (
    <div className="button-row" style={{ flexWrap: "wrap", gap: 10 }}>
      {tags.map((tag) => (
        <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={selected.includes(tag.name)}
            onChange={(event) => toggle(tag.name, event.target.checked)}
          />
          {tag.name}
        </label>
      ))}
      {!allowCreate && tags.length === 0 ? null : creating ? (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            style={{ width: 160 }}
            value={name}
            autoFocus
            placeholder="Nama tag baru"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === "Escape") {
                setCreating(false);
                setName("");
              }
              if (event.key === "Enter" && name.trim()) {
                setBusy(true);
                setError("");
                try {
                  await backendApi("/api/admin/tags", csrfToken, { name: name.trim() });
                  await onCreated();
                  onChange([...selected, name.trim()]);
                  setCreating(false);
                  setName("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Gagal membuat tag.");
                } finally {
                  setBusy(false);
                }
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await backendApi("/api/admin/tags", csrfToken, { name: name.trim() });
                await onCreated();
                onChange([...selected, name.trim()]);
                setCreating(false);
                setName("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal membuat tag.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "..." : "Simpan"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setName("");
            }}
          >
            Batal
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setError("");
          }}
        >
          + Tag baru
        </button>
      )}
      {error && (
        <span role="alert" style={{ color: "#b00" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export function TagManager({ csrfToken }: { csrfToken: string }) {
  const { tags, error, setError, refresh } = useManagedTags(csrfToken);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <table style={{ width: "100%", maxWidth: 640, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Tag</th>
            <th style={{ textAlign: "left" }}>Dipakai</th>
            <th style={{ textAlign: "left" }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag.id}>
              <td>
                {editing === tag.id ? (
                  <input value={name} autoFocus onChange={(event) => setName(event.target.value)} />
                ) : (
                  tag.name
                )}
              </td>
              <td>{tag.usage}</td>
              <td>
                {editing === tag.id ? (
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <button
                      type="button"
                      disabled={busy || !name.trim()}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await backendApi(
                            "/api/admin/tags/" + tag.id,
                            csrfToken,
                            { name: name.trim() },
                            "PATCH",
                          );
                          setEditing(null);
                          await refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Gagal mengubah tag.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setName("");
                      }}
                    >
                      Batal
                    </button>
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(tag.id);
                        setName(tag.name);
                      }}
                    >
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            'Hapus tag "' + tag.name + '"? Tag ini akan dilepas dari semua konten.',
                          )
                        )
                          return;
                        setBusy(true);
                        setError("");
                        try {
                          await backendApi(
                            "/api/admin/tags/" + tag.id,
                            csrfToken,
                            undefined,
                            "DELETE",
                          );
                          await refresh();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Gagal menghapus tag.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    >
                      Hapus
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {tags.length === 0 && (
            <tr>
              <td colSpan={3}>Belum ada tag.</td>
            </tr>
          )}
        </tbody>
      </table>
      {error && (
        <p role="alert" style={{ color: "#b00" }}>
          {error}
        </p>
      )}
    </div>
  );
}
