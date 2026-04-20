import argon2 from "argon2";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";

async function main() {
  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error(
      "[seed] ADMIN_USERNAME a ADMIN_PASSWORD musí být nastaveny v env (viz .env.local / .env)."
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`[seed] User '${username}' už existuje — seed přeskočen.`);
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456, // 19 MiB — OWASP 2024 minimum
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.create({
    data: { username, passwordHash },
  });

  console.log(`[seed] Vytvořen admin user '${username}'.`);
}

main()
  .catch((e) => {
    console.error("[seed] Selhalo:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
