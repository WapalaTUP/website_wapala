import { DomainError } from "../errors";
export async function readMultipart(request: Request, maxBytes: number) {
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;"))
    throw new DomainError("INVALID_CONTENT_TYPE", 415);
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new DomainError("BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("INVALID_INPUT", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new DomainError("BODY_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "content-type": type },
    }).formData();
  } catch {
    throw new DomainError("INVALID_INPUT", 400, "Berkas unggahan tidak valid.");
  }
}
