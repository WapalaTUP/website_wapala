"use client";
import type { ImportIssue } from "@/lib/backend-import";
export class BackendApiError extends Error {
  constructor(
    message: string,
    public issues: ImportIssue[] = [],
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}
export async function backendApi<T>(
  path: string,
  csrfToken: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : method,
    credentials: "same-origin",
    cache: "no-store",
    headers:
      body === undefined ? {} : { "content-type": "application/json", "x-csrf-token": csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new BackendApiError(
      data.error || "Permintaan tidak dapat diproses. Coba kembali.",
      Array.isArray(data.issues)
        ? data.issues.filter(
            (issue: ImportIssue) =>
              Number.isInteger(issue.row) &&
              typeof issue.field === "string" &&
              typeof issue.message === "string",
          )
        : [],
    );
  return data as T;
}
export async function uploadMedia(file: File, purpose: string, csrfToken: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("purpose", purpose);
  const response = await fetch("/api/admin/media", {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-csrf-token": csrfToken, "x-media-purpose": purpose },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Foto belum dapat diunggah.");
  return data.url as string;
}
