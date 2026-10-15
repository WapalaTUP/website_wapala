"use client";
import Link from "next/link";
import { useState } from "react";
import { Notice } from "../ui";
import { authPost } from "./client-api";
import type { Role } from "@/server/auth/policy";
import { backendModules, backendRoleModules } from "../backend/admin-shell";
export function FoundationHome({
  name,
  role,
  csrfToken,
}: {
  name: string;
  role: string;
  csrfToken: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="container section auth-panel">
      <h1>Portal WAPALA.</h1>
      <p>
        {name} · {role}
      </p>
      <Notice>
        Sesi ini sudah diverifikasi server. Pilih modul organisasi di bawah
        untuk mengelola data sesuai izin akun. Data berasal dari database, bukan
        pratinjau browser.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <nav aria-label="Modul organisasi" className="button-row">
        {(backendRoleModules[role as Role] || []).map((key) => (
          <Link key={key} className="btn secondary" href={"/admin/" + key}>
            {backendModules[key]}
          </Link>
        ))}
      </nav>
      <div className="button-row">
        <Link className="btn secondary" href="/wapala/password">
          Ganti password
        </Link>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await authPost("logout", {}, csrfToken);
              window.location.assign(result.redirectTo || "/wapala");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Logout gagal.");
              setBusy(false);
            }
          }}
        >
          {busy ? "Keluar…" : "Logout"}
        </button>
        <Link className="text-link" href="/">
          Website publik
        </Link>
      </div>
    </main>
  );
}
