import type { APIRoute } from "astro";
import { extractBearer, verifyApiToken } from "@/lib/tokens";
import { parseHaePayload } from "@/lib/health-parser";
import { importHealthRows } from "@/lib/health-import";

export const prerender = false;

const MAX_BODY_BYTES = 100 * 1024 * 1024; // 100 MB

export const POST: APIRoute = async ({ request }) => {
  // ---- Auth ----
  // Preferovaně `x-api-key` (HAE posílá custom header), fallback Bearer token.
  // Obojí mapuje na existující ApiToken tabulku (argon2 hash, revocation).
  const apiKeyHeader = request.headers.get("x-api-key");
  const bearerToken = extractBearer(request.headers.get("authorization"));
  const token = apiKeyHeader ?? bearerToken;
  if (!token) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const auth = await verifyApiToken(token);
  if (!auth) return Response.json({ error: "INVALID_TOKEN" }, { status: 401 });

  // ---- Body size guard ----
  // HAE roční export ~2.6 MB, ale denní přírůstek pod 100 KB. Cap na 100 MB
  // chrání před omylem velkým uploadem.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: "PAYLOAD_TOO_LARGE", limit: MAX_BODY_BYTES, received: contentLength },
      { status: 413 }
    );
  }

  // ---- Parse ----
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = parseHaePayload(payload);

  if (parsed.metrics.length === 0 && parsed.ecgs.length === 0) {
    return Response.json(
      { error: "NO_DATA", stats: parsed.stats },
      { status: 400 }
    );
  }

  // ---- Bulk insert ----
  try {
    const stats = await importHealthRows(auth.userId, parsed.metrics, parsed.ecgs);
    return Response.json({
      ok: true,
      parser: parsed.stats,
      db: stats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "DB_ERROR", message: msg }, { status: 500 });
  }
};
