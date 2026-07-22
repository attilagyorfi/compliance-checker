import http from "node:http";
const mod = await import("./api/[...path].js");
const handler = mod.default;
const server = http.createServer((req, res) => handler(req, res));
await new Promise((r) => server.listen(3999, r));
try {
  const r1 = await fetch("http://localhost:3999/api/demo-enabled");
  console.log(`GET /api/demo-enabled → ${r1.status} ${await r1.text()}`);
  const r2 = await fetch("http://localhost:3999/api/trpc/system.health", { headers: { "content-type": "application/json" } });
  console.log(`GET /api/trpc/... → ${r2.status} (a route él, nem 404/500-as összeomlás)`);
} catch (e) {
  console.log("HIBA:", String(e.message).slice(0, 150));
} finally {
  server.close();
}
