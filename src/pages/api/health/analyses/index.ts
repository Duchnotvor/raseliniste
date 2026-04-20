import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";
import { readSession } from "@/lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = await readSession(cookies);
  if (!session) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const analyses = await prisma.healthAnalysis.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      periodFrom: true,
      periodTo: true,
      focus: true,
      trigger: true,
      model: true,
      totalSamples: true,
      metricsWithData: true,
      emailSentAt: true,
      emailError: true,
      createdAt: true,
    },
  });
  return Response.json({ analyses });
};
