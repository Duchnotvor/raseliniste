import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { listProjects } from "@/lib/todoist";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const integration = await prisma.userIntegration.findUnique({
    where: { userId_provider: { userId: session.uid, provider: "todoist" } },
  });
  if (!integration) {
    return Response.json({ projects: [] });
  }

  try {
    const token = decryptSecret({
      enc: integration.tokenEnc,
      iv: integration.tokenIv,
      tag: integration.tokenTag,
    });
    const projects = await listProjects(token);
    return Response.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        is_inbox_project: p.is_inbox_project ?? false,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: { lastError: msg },
    });
    return Response.json({ error: msg }, { status: 500 });
  }
};
