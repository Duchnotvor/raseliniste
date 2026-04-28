import type { APIRoute } from "astro";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { resolveUpload, uploadExists } from "@/lib/uploads";

export const prerender = false;

/**
 * GET /api/studna/recordings/:id/audio
 *   Streamne audio soubor pro owner (přehrávač v detailu).
 *   Auth: session + ownership přes project.userId.
 */
export const GET: APIRoute = async ({ cookies, params }) => {
  const session = await readSession(cookies);
  if (!session) return new Response("Unauthorized", { status: 401 });
  const id = params.id;
  if (!id) return new Response("Bad request", { status: 400 });

  const recording = await prisma.projectRecording.findFirst({
    where: { id, project: { userId: session.uid } },
    select: { audioPath: true, audioMime: true },
  });
  if (!recording) return new Response("Not found", { status: 404 });
  if (!recording.audioPath || !(await uploadExists(recording.audioPath))) {
    return new Response("Audio bylo automaticky smazáno (>14 dní). Připnutí zachovává soubor permanentně.", {
      status: 404,
    });
  }

  const buf = await fs.readFile(resolveUpload(recording.audioPath));
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": recording.audioMime ?? "audio/webm",
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
};
