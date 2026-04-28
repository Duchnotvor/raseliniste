import type { APIRoute } from "astro";
import { prisma } from "@/lib/db";

export const prerender = false;

/**
 * GET /api/me/:token
 *   Public — vrátí seznam projektů, do kterých je host pozván.
 *   Slouží jako bootstrap pro `/me/:token` dropdown.
 */
export const GET: APIRoute = async ({ params }) => {
  const token = params.token;
  if (!token) return Response.json({ error: "INVALID_TOKEN" }, { status: 400 });

  const guest = await prisma.guestUser.findUnique({
    where: { guestToken: token },
    include: {
      invitations: {
        where: {
          project: { archivedAt: null },
        },
        include: {
          project: { select: { id: true, name: true, homeTitle: true, description: true } },
        },
      },
    },
  });

  if (!guest) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Touch lastSeenAt
  await prisma.guestUser.update({
    where: { id: guest.id },
    data: { lastSeenAt: new Date() },
  });

  return Response.json({
    guest: {
      name: guest.name,
      email: guest.email,
    },
    projects: guest.invitations.map((inv) => ({
      id: inv.project.id,
      name: inv.project.name,
      homeTitle: inv.project.homeTitle,
      description: inv.project.description,
      canRecordBrief: inv.canRecordBrief,
    })),
  });
};
