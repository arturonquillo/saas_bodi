import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { UrlEgressGuardPort } from "@saas-frota/shared";
import { ApiError } from "../http/respond";

function isBlockedIp(ip: string): boolean {
  if (ip === "0.0.0.0" || ip === "::" || ip === "::1") return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true;
  // IPv6 link-local / ULA
  const lower = ip.toLowerCase();
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

export const urlEgressGuard: UrlEgressGuardPort = {
  async assertSafeHttpsUrl(url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ApiError("validacao", "URL inválida.");
    }
    const allowHttpLoopback =
      process.env.EGRESS_ALLOW_HTTP_LOOPBACK === "true" && parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !allowHttpLoopback) {
      throw new ApiError("validacao", "Somente URLs https são permitidas.");
    }
    const hostname = parsed.hostname;
    if (isIP(hostname)) {
      if (isBlockedIp(hostname) && !allowHttpLoopback) {
        throw new ApiError("forbidden", "Destino de egress bloqueado.");
      }
    } else {
      const records = await lookup(hostname, { all: true }).catch(() => {
        throw new ApiError("validacao", "Não foi possível resolver o host.");
      });
      for (const rec of records) {
        if (isBlockedIp(rec.address)) {
          throw new ApiError("forbidden", "Destino de egress bloqueado.");
        }
      }
    }
    return { href: parsed.href, hostname };
  },
};
