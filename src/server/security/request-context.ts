import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { getConfig, type ServerConfig } from "../config";
import { hmacToken } from "./tokens";
export interface RequestContext {
  ipDigest: string;
  userAgent: string;
  requestId: string;
}
export function requestContext(
  request: Request,
  config: ServerConfig = getConfig(),
): RequestContext {
  const candidate = config.trustProxy
    ? request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    : undefined;
  const ip = candidate && isIP(candidate) ? candidate : "unknown";
  return {
    ipDigest: hmacToken("ip:" + ip, config.securityKey),
    userAgent: (request.headers.get("user-agent") || "")
      .replace(/[\r\n\0]/g, "")
      .slice(0, 256),
    requestId: randomUUID(),
  };
}
