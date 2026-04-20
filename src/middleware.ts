import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE } from "./lib/session";

// Public stránky a endpointy, které nevyžadují session cookie.
// Passkey flow má svou vlastní autorizaci přes rs_preauth cookie (JWT po hesle).
const PUBLIC_PATHS = new Set<string>(["/login", "/api/auth/login"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_astro/")) return true;
  if (pathname.startsWith("/api/auth/logout")) return true;
  if (pathname.startsWith("/api/auth/passkey/")) return true;
  // /api/ingest má svou vlastní Bearer token autorizaci (mobile shortcut).
  if (pathname === "/api/ingest") return true;
  // /api/journal/ingest — direct JOURNAL write s Bearer/x-api-key.
  if (pathname === "/api/journal/ingest") return true;
  // /api/health-ingest používá x-api-key (Health Auto Export z iPhonu).
  if (pathname === "/api/health-ingest") return true;
  // Cron endpointy mají vlastní x-cron-key autorizaci.
  if (pathname.startsWith("/api/cron/")) return true;
  return false;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function applySecurityHeaders(response: Response): Response {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(k)) response.headers.set(k, v);
  }
  return response;
}

export const onRequest = defineMiddleware(async ({ request, cookies, url, redirect }, next) => {
  if (isPublic(url.pathname)) {
    return applySecurityHeaders(await next());
  }

  const hasCookie = Boolean(cookies.get(SESSION_COOKIE)?.value);
  if (hasCookie) {
    // Skutečné ověření (JWT + DB session) si každá stránka/API ještě dělá sama
    // přes readSession() — middleware je jen optimistic check.
    return applySecurityHeaders(await next());
  }

  // API → 401 JSON; stránky → redirect na login.
  if (url.pathname.startsWith("/api/")) {
    return applySecurityHeaders(
      new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );
  }
  return redirect("/login");
});
