export function contentSecurityPolicy(nonce: string, production: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    `style-src 'self'${production ? " 'nonce-" + nonce + "'" : " 'unsafe-inline'"}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src https://www.google.com https://maps.google.com https://www.instagram.com https://www.tiktok.com https://www.youtube-nocookie.com https://player.vimeo.com blob:",
    "worker-src 'self' blob:",
    `connect-src 'self'${production ? "" : " ws: wss:"}`,
    "media-src 'self' blob:",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
