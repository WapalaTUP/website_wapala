"use client";
import { useState, type FormEvent } from "react";
import { Field, Notice } from "../ui";
import { authPost } from "./client-api";
export function PasswordChange({ csrfToken }: { csrfToken: string }) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (password !== confirmation)
        throw new Error("Konfirmasi password belum sesuai.");
      const result = await authPost(
        "password",
        { currentPassword: current, newPassword: password },
        csrfToken,
      );
      window.location.assign(result.redirectTo || "/wapala");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container section auth-panel">
      <h1>Perbarui password.</h1>
      <p>
        Gunakan passphrase minimal 12 karakter. Setelah diperbarui, semua sesi
        akun akan dicabut dan kamu perlu login kembali.
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <Field
          label="Password saat ini"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="Password baru"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Ulangi password baru"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Memperbarui…" : "Simpan password baru"}
        </button>
      </form>
    </main>
  );
}
