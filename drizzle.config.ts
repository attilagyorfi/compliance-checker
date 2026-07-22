import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

/**
 * A felhő-adatbázisok (TiDB Cloud stb.) kötelező TLS-t várnak, a lokál Docker
 * MySQL viszont TLS nélkül fut.
 *
 * Fontos: a drizzle-kit az `{ url, ssl }` kombinációnál figyelmen kívül hagyja
 * az ssl mezőt, ezért távoli DB-nél szétbontjuk a kapcsolati adatokat — így a
 * TLS biztosan érvényre jut ("Connections using insecure transport are
 * prohibited" hiba nélkül).
 */
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);

function remoteCredentials(raw: string) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  };
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: isLocal
    ? { url: connectionString }
    : remoteCredentials(connectionString),
});
