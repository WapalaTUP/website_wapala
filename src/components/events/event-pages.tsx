"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDemo } from "@/lib/store";
import {
  validateEventAnswers,
  visibleEventItems,
  type EventAnswers,
  type EventIssue,
  type EventForm,
} from "@/lib/event-form";
import type { EventPublicDto } from "@/lib/event-types";
import { Notice, Empty } from "../ui";
import { PageIntro } from "../page-intro";
import { EventFormRenderer } from "./form-renderer";
import { eventFailureAction, retainedEventAnswers } from "@/lib/event-submit";
const time = (s: string) =>
  s
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(s)) + " WIB"
    : "";
export function EventCard({ event }: { event: EventPublicDto }) {
  return (
    <article className="event-public-card">
      {(event.poster || event.cover) && (
        <Link href={"/event/" + event.id}>
          <Image
            className="event-poster"
            src={event.poster || event.cover}
            width={600}
            height={750}
            alt={"Poster " + event.title}
            unoptimized
          />
        </Link>
      )}
      <div>
        <span className="badge">
          {event.accepting
            ? "Pendaftaran dibuka"
            : event.status === "closed"
              ? "Ditutup"
              : "Belum dibuka / kuota penuh"}
        </span>
        <h2>
          <Link href={"/event/" + event.id}>{event.title}</Link>
        </h2>
        <p>{event.description.slice(0, 300)}</p>
        {event.eventAt && <p>{time(event.eventAt)}</p>}
        {event.location && <p>{event.location}</p>}
        <Link
          className={event.accepting ? "btn primary" : "btn secondary"}
          href={"/event/" + event.id}
        >
          {event.accepting ? "Daftar event" : "Lihat kegiatan"}
        </Link>
      </div>
    </article>
  );
}
export function EventPages({ id }: { id?: string }) {
  const state = useDemo();
  const [context, setContext] = useState<{
      event: EventPublicDto;
      token: string;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch("/api/events/" + id + "/context", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Event tidak ditemukan.");
        if (active) {
          setContext(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (!id)
    return (
      <>
        <PageIntro
          title={"Bertemu, belajar,\nbergerak bersama."}
          description="Kegiatan WAPALA dan ruang untuk ikut mengambil bagian."
        />
        <div className="container section event-public-list">
          {state.events?.length ? (
            state.events.map((event) => (
              <EventCard event={event} key={event.id} />
            ))
          ) : (
            <Empty
              title="Belum ada event yang dipublikasikan"
              description="Informasi kegiatan akan tampil setelah dibuka oleh pengelola."
            />
          )}
        </div>
      </>
    );
  return (
    <div className="container section event-detail">
      <Link href="/event" className="text-link">
        Kembali ke event
      </Link>
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : !context ? (
        <p role="status">Memuat kegiatan…</p>
      ) : (
        <EventDetail key={context.event.id} initial={context} />
      )}
    </div>
  );
}
function EventDetail({
  initial,
}: {
  initial: { event: EventPublicDto; token: string };
}) {
  const [context, setContext] = useState(initial),
    [answers, setAnswers] = useState<EventAnswers>({}),
    [issues, setIssues] = useState<EventIssue[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(""),
    [website, setWebsite] = useState(""),
    [page, setPage] = useState(0),
    [uncertain, setUncertain] = useState(false),
    [reconciling, setReconciling] = useState(false),
    [changed, setChanged] = useState(false);
  const lock = useRef(false),
    pendingUploads = useRef(0),
    attempt = useRef<{
      eventId: string;
      revisionId: string;
      idempotencyKey: string;
      answers: EventAnswers;
      website: string;
    } | null>(null);
  const event = context.event;
  const visible = visibleEventItems(event.form, answers),
    groups: EventForm["items"][] = [[]];
  for (const q of visible) {
    if (q.kind === "section" && groups.at(-1)!.length) groups.push([]);
    groups.at(-1)!.push(q);
  }
  const current = Math.min(page, groups.length - 1);
  async function refreshForm() {
    setBusy(true);
    try {
      const r = await fetch("/api/events/" + event.id + "/context", {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const retained = retainedEventAnswers(d.event.form, answers);
      setAnswers(retained.answers);
      setContext(d);
      setChanged(false);
      setPage(0);
      setIssues([]);
      attempt.current = null;
      setError(
        "Formulir terbaru dimuat. Tinjau jawaban sebelum mengirim kembali." +
          (retained.clearedUploads
            ? " Pilih ulang berkas upload untuk sesi formulir baru."
            : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Formulir belum dapat dimuat.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (lock.current || pendingUploads.current || receipt) return;
    const result = validateEventAnswers(event.form, answers);
    if (!attempt.current && result.issues.length) {
      setIssues(result.issues);
      const first = groups.findIndex((items) =>
        items.some((q) => q.id === result.issues[0].questionId),
      );
      setPage(Math.max(0, first));
      setError("Periksa pertanyaan yang ditandai.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    if (!attempt.current)
      attempt.current = {
        eventId: event.id,
        revisionId: event.revisionId,
        idempotencyKey: crypto.randomUUID(),
        answers: result.answers,
        website,
      };
    try {
      const response = await fetch(
        "/api/events/" +
          event.id +
          (reconciling ? "/reconcile" : "/registrations"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-event-token": context.token,
          },
          body: JSON.stringify(attempt.current),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        const recovery = eventFailureAction(response.status, data.code);
        if (recovery === "reconcile") {
          setReconciling(true);
          setChanged(false);
        }
        if (recovery === "correct" || recovery === "refresh") {
          attempt.current = null;
          setUncertain(false);
        }
        if (recovery === "refresh") setChanged(true);
        if (Array.isArray(data.questions)) setIssues(data.questions);
        throw new Error(data.error || "Pendaftaran belum dapat diproses.");
      }
      if (reconciling && !data.code) {
        attempt.current = null;
        setUncertain(false);
        setReconciling(false);
        setChanged(true);
        setError(
          "Percobaan sebelumnya tidak tersimpan dan sudah ditutup. Muat formulir baru untuk melanjutkan dengan aman.",
        );
        return;
      }
      setReceipt(data.code);
      setUncertain(false);
    } catch (e) {
      if (attempt.current) setUncertain(true);
      setError(
        e instanceof Error
          ? e.message
          : "Koneksi terputus. Coba kirim ulang permintaan yang sama.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function upload(questionId: string, file: File) {
    pendingUploads.current++;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("questionId", questionId);
      body.set("file", file);
      const r = await fetch("/api/events/" + event.id + "/uploads", {
        method: "POST",
        headers: { "x-event-token": context.token },
        body,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Berkas belum dapat diunggah.");
      setAnswers((a) => ({ ...a, [questionId]: d.id }));
    } finally {
      pendingUploads.current--;
      setBusy(pendingUploads.current > 0);
    }
  }
  return (
    <>
      <div className="event-detail-intro">
        {(event.poster || event.cover) && (
          <Image
            src={event.poster || event.cover}
            width={700}
            height={900}
            className="event-poster"
            alt={"Poster " + event.title}
            unoptimized
          />
        )}
        <div>
          <h1>{event.title}</h1>
          <p className="event-description">{event.description}</p>
          {event.eventAt && <p>Jadwal: {time(event.eventAt)}</p>}
          {event.location && <p>Lokasi: {event.location}</p>}
          {event.start && <p>Pendaftaran mulai: {time(event.start)}</p>}
          {event.end && <p>Pendaftaran selesai: {time(event.end)}</p>}
        </div>
      </div>
      {receipt ? (
        <Notice tone="success">
          <h2>Pendaftaran diterima.</h2>
          <p>
            Kode pendaftaran: <strong>{receipt}</strong>
          </p>
          <p>Simpan kode ini sebagai referensi untuk menghubungi pengelola.</p>
        </Notice>
      ) : !event.accepting ? (
        <Notice>
          Pendaftaran belum dibuka, telah ditutup, atau kuota penuh.
        </Notice>
      ) : (
        <form
          className="event-signup"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <div className="event-form-heading">
            <h2>{event.form.title}</h2>
            <p>{event.form.description}</p>
            <p>Pertanyaan bertanda * wajib diisi.</p>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {uncertain && (
            <Notice>
              Koneksi belum memastikan hasil. Kirim ulang memakai permintaan
              yang sama; jangan membuka formulir baru.
            </Notice>
          )}
          {changed && (
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={refreshForm}
            >
              Muat formulir terbaru, pertahankan jawaban yang sesuai
            </button>
          )}
          <div className="event-honeypot" aria-hidden="true">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
          <EventFormRenderer
            form={event.form}
            itemIds={groups[current].map((q) => q.id)}
            answers={answers}
            onChange={(id, v) => {
              setAnswers((a) => ({ ...a, [id]: v }));
              setIssues((e) => e.filter((x) => x.questionId !== id));
            }}
            disabled={busy || uncertain || changed}
            issues={issues}
            onUpload={upload}
          />
          <div className="event-signup-actions">
            {groups.length > 1 && (
              <span>
                Bagian {current + 1} dari {groups.length}
              </span>
            )}
            {current > 0 && !uncertain && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPage(current - 1)}
                disabled={busy}
              >
                Kembali
              </button>
            )}
            {current < groups.length - 1 && !uncertain ? (
              <button
                type="button"
                className="btn primary"
                disabled={busy || changed}
                onClick={() => {
                  const ids = new Set(groups[current].map((q) => q.id));
                  const errors = validateEventAnswers(
                    event.form,
                    answers,
                  ).issues.filter((x) => ids.has(x.questionId));
                  setIssues(errors);
                  if (!errors.length) setPage(current + 1);
                }}
              >
                Berikutnya
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={busy || changed}
              >
                {busy
                  ? "Mengirim…"
                  : reconciling
                    ? "Periksa hasil pengiriman sebelumnya"
                    : uncertain
                      ? "Kirim ulang permintaan yang sama"
                      : "Kirim pendaftaran"}
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
