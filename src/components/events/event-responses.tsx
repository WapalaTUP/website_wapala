"use client";
import { useEffect, useState } from "react";
import { backendApi } from "../backend/api";
import { Empty, Modal, Notice } from "../ui";
import { eventAnswerLabel } from "@/lib/event-form";
import type { EventRegistrationDto } from "@/lib/event-types";
type Data = {
  rows: EventRegistrationDto[];
  total: number;
  page: number;
  revisions: Array<{ id: string; number: number }>;
};
const date = (s: string) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
export function EventResponses({
  eventId,
  csrfToken,
}: {
  eventId: string;
  csrfToken: string;
}) {
  const [data, setData] = useState<Data>({
      rows: [],
      total: 0,
      page: 1,
      revisions: [],
    }),
    [filter, setFilter] = useState({
      revisionId: "",
      from: "",
      to: "",
      query: "",
    }),
    [params, setParams] = useState("page=1"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<EventRegistrationDto | null>(null),
    [exporting, setExporting] = useState(false);
  useEffect(() => {
    let valid = true;
    backendApi<Data>(
      "/api/admin/events/" + eventId + "/responses?" + params,
      csrfToken,
    )
      .then((result) => {
        if (valid) {
          setData(result);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (valid) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      valid = false;
    };
  }, [eventId, csrfToken, params]);
  const page = (n: number) => {
    const p = new URLSearchParams(params);
    p.set("page", String(n));
    setLoading(true);
    setParams(p.toString());
  };
  async function download() {
    setExporting(true);
    setError("");
    try {
      const r = await fetch(
        "/api/admin/events/" + eventId + "/export?" + params,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Ekspor gagal.");
      }
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "Pendaftar-Event-" + eventId + ".xlsx";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekspor gagal.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="event-responses">
      <div className="event-response-summary">
        <h2>{data.total} respons</h2>
        <button
          className="btn secondary"
          disabled={exporting || loading}
          onClick={download}
        >
          {exporting ? "Menyiapkan Excel…" : "Ekspor Excel"}
        </button>
      </div>
      <form
        className="event-response-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setParams(new URLSearchParams({ ...filter, page: "1" }).toString());
        }}
      >
        <label>
          Versi formulir
          <select
            value={filter.revisionId}
            onChange={(e) =>
              setFilter({ ...filter, revisionId: e.target.value })
            }
          >
            <option value="">Semua versi</option>
            {data.revisions.map((r) => (
              <option key={r.id} value={r.id}>
                Versi {r.number}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dari tanggal (WIB)
          <input
            type="date"
            value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
          />
        </label>
        <label>
          Sampai tanggal (WIB)
          <input
            type="date"
            value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
          />
        </label>
        <label>
          Cari kode atau jawaban
          <input
            type="search"
            maxLength={200}
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        </label>
        <button className="btn secondary" disabled={loading}>
          Terapkan filter
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <p role="status">Memuat respons…</p>
      ) : !data.rows.length ? (
        <Empty
          title="Belum ada respons pada filter ini"
          description="Pendaftaran yang diterima akan muncul di sini."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kode pendaftaran</th>
                  <th>Waktu (WIB)</th>
                  <th>Versi</th>
                  <th>Jawaban</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{date(r.createdAt)}</td>
                    <td>{r.revisionNumber}</td>
                    <td>
                      {r.form.items
                        .filter(
                          (q) =>
                            q.kind !== "section" &&
                            q.kind !== "upload" &&
                            r.answers[q.id] !== undefined,
                        )
                        .slice(0, 2)
                        .map((q) => (
                          <div key={q.id}>
                            {q.title}:{" "}
                            {String(eventAnswerLabel(q, r.answers[q.id])).slice(
                              0,
                              100,
                            )}
                          </div>
                        ))}
                    </td>
                    <td>
                      <button
                        className="btn secondary"
                        onClick={() => setSelected(r)}
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="event-pagination">
            <button
              className="btn secondary"
              disabled={data.page <= 1}
              onClick={() => page(data.page - 1)}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {data.page} / {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            <button
              className="btn secondary"
              disabled={data.page * 50 >= data.total}
              onClick={() => page(data.page + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      )}
      <Modal
        open={!!selected}
        title={selected?.code ?? "Detail respons"}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <p>
              {date(selected.createdAt)}. Versi {selected.revisionNumber}
            </p>
            <dl className="event-response-detail">
              {selected.form.items
                .filter((q) => q.kind !== "section")
                .map((q) => (
                  <div key={q.id}>
                    <dt>{q.title}</dt>
                    <dd>
                      {selected.answers[q.id] === undefined ? (
                        "Tidak diisi"
                      ) : q.kind === "upload" ? (
                        <a
                          className="text-link"
                          href={"/api/media/" + selected.answers[q.id]}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lihat berkas
                        </a>
                      ) : (
                        String(eventAnswerLabel(q, selected.answers[q.id]))
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        )}
      </Modal>
    </div>
  );
}
