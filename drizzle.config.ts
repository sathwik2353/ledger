
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    process.env[match[1]] = value;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

export default defineConfig({
  schema: "./src/lib/auth-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
