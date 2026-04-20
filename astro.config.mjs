import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react(), icon({ include: { lucide: ["*"] } })],
  server: {
    port: 3000,
    host: true,
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: ["argon2", "@prisma/adapter-pg", "pg"],
    },
  },
  security: {
    checkOrigin: true,
  },
});
