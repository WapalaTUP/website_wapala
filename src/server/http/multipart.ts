import { DomainError } from "../errors";
// Akumulasi body multipart ke SATU buffer yang tumbuh terbatas
// (bukan array chunk + Buffer.concat) agar puncak memori ~1x ukuran
// berkas, bukan 3-4x. formData() dari Undici menyalin sekali lagi.
export async function readMultipart(request: Request, maxBytes: number) {
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;")) throw new DomainError("INVALID_CONTENT_TYPE", 415);
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new DomainError("BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("INVALID_INPUT", 400);
  let buffer: Uint8Array<ArrayBuffer> | null = null;
  let offset = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > maxBytes) {
        await reader.cancel();
        throw new DomainError("BODY_TOO_LARGE", 413);
      }
      if (!buffer || offset + value.byteLength > buffer.length) {
        const nextSize = Math.min(
          Math.max(buffer ? buffer.length * 2 : 1 << 20, offset + value.byteLength),
          maxBytes,
        );
        const grown = new Uint8Array(new ArrayBuffer(nextSize));
        if (buffer) grown.set(buffer.subarray(0, offset));
        buffer = grown;
      }
      buffer.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(buffer!.subarray(0, offset), {
      headers: { "content-type": type },
    }).formData();
  } catch {
    throw new DomainError("INVALID_INPUT", 400, "Berkas unggahan tidak valid.");
  }
}
