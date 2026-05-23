import { defineConfig } from "prisma/config";

// Locally, load .env.local for database credentials
if (!process.env.VERCEL) {
  const { config } = require("dotenv");
  config({ path: ".env.local" });
  config({ path: ".env" });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
