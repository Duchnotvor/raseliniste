import { prisma } from "./db";

const WINDOW_MIN = 15;
const MAX_FAILED_PER_USERNAME = 5;
const MAX_FAILED_PER_IP = 20;

export type RateLimitResult = null | "USERNAME_LOCKED" | "IP_LOCKED";

export async function checkLoginRateLimit(username: string, ip: string): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000);
  const [nameFails, ipFails] = await Promise.all([
    prisma.loginAttempt.count({
      where: { username, success: false, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    }),
  ]);
  if (nameFails >= MAX_FAILED_PER_USERNAME) return "USERNAME_LOCKED";
  if (ipFails >= MAX_FAILED_PER_IP) return "IP_LOCKED";
  return null;
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { username, ip, success } });
}
