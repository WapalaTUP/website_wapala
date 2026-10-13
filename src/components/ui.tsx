"use client";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { X, UploadCloud, AlertCircle, Search } from "lucide-react";
import { uploadError } from "@/lib/domain";
export function Field({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && <span className="required"> *</span>}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || hint ? id + "-hint" : undefined}
      />
      {(error || hint) && (
        <p id={id + "-hint"} className={error ? "field-error" : "field-hint"}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function Select({
  label,
  options,
  value,
  onChange,
  required = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">Pilih {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
export function Textarea({
  label,
  value,
  onChange,
  required = false,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
      />
    </div>
  );
}
export function Upload({
  label,
  onFiles,
  names = [],
  kind = "photo",
  multiple = false,
  error,
  setError,
}: {
  label: string;
  onFiles: (files: File[]) => void;
  names?: string[];
  kind?: "photo" | "proof" | "book";
  multiple?: boolean;
  error?: string;
  setError: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="upload-box">
        <UploadCloud size={28} />
        <div>
          <strong>
            {names.length ? names.join(", ") : "Pilih berkas dari perangkat"}
          </strong>
          <p>
            {kind === "book"
              ? "PDF / EPUB · maksimal 50 MB"
              : kind === "proof"
                ? "JPG / PNG / WebP / PDF · maksimal 5 MB"
                : "JPG / PNG / WebP · maksimal 5 MB per foto"}
          </p>
        </div>
        <input
          id={id}
          type="file"
          multiple={multiple}
          accept={
            kind === "book"
              ? ".pdf,.epub"
              : kind === "proof"
                ? ".jpg,.jpeg,.png,.webp,.pdf"
                : ".jpg,.jpeg,.png,.webp"
          }
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            const err = files.map((f) => uploadError(f, kind)).find(Boolean);
            if (files.length > 8) {
              setError("Maksimal 8 foto per unggahan.");
              e.target.value = "";
              return;
            }
            if (err) {
              setError(err);
              e.target.value = "";
              return;
            }
            setError("");
            onFiles(files);
          }}
        />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={"notice " + tone}
      role={tone === "error" ? "alert" : undefined}
    >
      <AlertCircle size={20} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Search size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const s = String(children);
  return (
    <span
      className={
        "badge " +
        (s.includes("Tolak") || s === "Ditolak" || s === "Terlambat"
          ? "danger"
          : s.includes("Menunggu") || s === "Diajukan"
            ? "warning"
            : s === "Disetujui" ||
                s === "Dikembalikan" ||
                s === "Terverifikasi" ||
                s === "Aktif"
              ? "success"
              : "neutral")
      }
    >
      {children}
    </span>
  );
}
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Tutup dialog"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  page,
  total,
  onChange,
  size = 6,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1) return null;
  return (
    <nav className="pagination" aria-label="Halaman">
      <button
        className="btn secondary"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Sebelumnya
      </button>
      <span>
        Halaman {page} dari {pages}
      </span>
      <button
        className="btn secondary"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
      >
        Berikutnya
      </button>
    </nav>
  );
}
