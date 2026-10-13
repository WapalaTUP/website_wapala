"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import type { EventAdminDto } from "@/lib/event-types";
import { backendApi } from "./api";
import { Empty, Notice, Badge } from "../ui";
import { EventEditor } from "../events/event-editor";
const status = {
  draft: "Draft",
  active: "Aktif",
  closed: "Ditutup",
  archived: "Arsip",
};
export function BackendEvents({
  initialEvents,
  csrfToken,
}: {
  initialEvents: EventAdminDto[];
  csrfToken: string;
}) {
  const [events, setEvents] = useState(initialEvents),
    [editing, setEditing] = useState<EventAdminDto | null | undefined>(
      undefined,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const update = (e: EventAdminDto) =>
    setEvents((rows) =>
      rows.some((x) => x.id === e.id)
        ? rows.map((x) => (x.id === e.id ? e : x))
        : [e, ...rows],
    );
  async function action(e: EventAdminDto, action: string) {
    if (lock.current) return;
    if (
      !window.confirm(
        action === "archive"
          ? "Arsipkan event? Semua respons tetap tersimpan."
          : action === "close"
            ? "Tutup pendaftaran event ini?"
            : "Buka kembali versi terakhir yang dipublikasikan?",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      update(
        await backendApi<EventAdminDto>("/api/admin/events/action", csrfToken, {
          id: e.id,
          version: e.version,
          action,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aksi belum dapat diproses.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (editing !== undefined)
    return (
      <EventEditor
        initial={editing}
        csrfToken={csrfToken}
        onSaved={(e) => {
          update(e);
          setEditing(e);
        }}
        onClose={() => setEditing(undefined)}
      />
    );
  return (
    <>
      <div className="admin-toolbar">
        <p>
          Kelola kegiatan, susun formulir sendiri, dan unduh hasil pendaftaran.
        </p>
        <button className="btn primary" onClick={() => setEditing(null)}>
          Tambah event
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!events.length && (
        <Empty
          title="Belum ada event"
          description="Buat event dan pertanyaan sesuai kebutuhan kegiatan WAPALA."
        />
      )}
      <div className="event-admin-list">
        {events.map((e) => (
          <article className="admin-panel event-admin-card" key={e.id}>
            <div>
              <Badge>{status[e.status]}</Badge>
              <h2>{e.draft.title}</h2>
              <p>{e.draft.description.slice(0, 200)}</p>
              <p>
                {e.registrationCount} pendaftar.{" "}
                {e.draft.form.items.filter((q) => q.kind !== "section").length}{" "}
                pertanyaan.
              </p>
            </div>
            <div className="event-card-actions">
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => setEditing(e)}
              >
                Edit / respons
              </button>
              {e.publishedRevisionId && (
                <Link className="text-link" href={"/event/" + e.id}>
                  Halaman publik
                </Link>
              )}
              {e.status === "active" ? (
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => action(e, "close")}
                >
                  Tutup pendaftaran
                </button>
              ) : e.publishedRevisionId && e.status !== "archived" ? (
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => action(e, "reopen")}
                >
                  Buka kembali
                </button>
              ) : null}
              {e.status !== "archived" && (
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => action(e, "archive")}
                >
                  Arsipkan
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
