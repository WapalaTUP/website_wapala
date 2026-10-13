import type { ZodType } from "zod";
import { DomainError } from "../errors";
export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = 16384,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new DomainError("INVALID_CONTENT_TYPE", 415);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new DomainError("BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("INVALID_INPUT", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new DomainError("BODY_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("INVALID_INPUT", 400);
  }
  const result = schema.safeParse(data);
  if (!result.success) throw result.error;
  return result.data;
}
