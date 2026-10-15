import type { ServerConfig } from "../config";
import { getConfig } from "../config";
import { DomainError } from "../errors";
import { constantEqual, hmacToken, newToken } from "./tokens";
export function assertOrigin(
  request: Request,
  config: ServerConfig = getConfig(),
) {
  if (request.headers.get("origin") !== config.appOrigin)
    throw new DomainError(
      "ORIGIN_DENIED",
      403,
      "Alamat halaman tidak sesuai. Buka portal melalui " +
        config.appOrigin +
        "/wapala.",
    );
}
export function csrfForSession(
  token: string,
  config: ServerConfig = getConfig(),
) {
  return hmacToken("session-csrf:" + token, config.securityKey);
}
export function createPreAuthToken(
  config: ServerConfig = getConfig(),
  now = new Date(),
) {
  const value = newToken() + "." + now.getTime();
  return value + "." + hmacToken("preauth:" + value, config.securityKey);
}
export function validatePreAuthToken(
  cookie: string | undefined,
  header: string | undefined,
  config: ServerConfig = getConfig(),
  now = new Date(),
) {
  if (
    !cookie ||
    !header ||
    cookie.length > 150 ||
    !constantEqual(cookie, header)
  )
    throw new DomainError(
      "CSRF_DENIED",
      403,
      "Sesi keamanan halaman sudah berubah. Muat ulang halaman dan coba kembali.",
    );
  const parts = cookie.split("."),
    timestamp = Number(parts[1]);
  if (
    parts.length !== 3 ||
    !Number.isFinite(timestamp) ||
    timestamp > now.getTime() ||
    now.getTime() - timestamp > 900000 ||
    !constantEqual(
      parts[2],
      hmacToken("preauth:" + parts[0] + "." + parts[1], config.securityKey),
    )
  )
    throw new DomainError(
      "CSRF_DENIED",
      403,
      "Sesi keamanan halaman kedaluwarsa. Muat ulang halaman dan coba kembali.",
    );
}
