/**
 * bbox_json célzott frissítése (Fázis 4 highlight-javítás).
 *
 * A javított parser (parse_pdf.py) most a bekezdés SORAINAK UNIÓJÁT tárolja
 * bbox-ként (nem csak az első sort/jelölőt). Ez a script kizárólag a
 * v2_chunks.bbox_json oszlopot frissíti a friss preview JSON-okból, a
 * chunk_key (= preview chunk .id) alapján — az embeddingeket NEM érinti.
 *
 * Futtatás:  DATABASE_URL a v2-adatbázisra mutatva:
 *   node ingestion/update-bbox.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PREVIEW = path.join(HERE, "preview");
if (!process.env.DATABASE_URL) { console.error("Nincs DATABASE_URL."); process.exit(1); }

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
});

let docs = 0, updated = 0, missing = 0, noBbox = 0;
for (const f of readdirSync(PREVIEW).filter((x) => x.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(path.join(PREVIEW, f), "utf-8"));
  const slug = j.document.slug;
  const [drows] = await conn.execute("SELECT id FROM v2_documents WHERE slug=? LIMIT 1", [slug]);
  if (!drows.length) { console.log(`⚠ ${slug}: nincs v2_documents sor`); continue; }
  const docId = drows[0].id;
  docs++;

  // Dokumentumonként egy CASE-UPDATE (gyors, kevés kör).
  const chunks = j.chunks.filter((c) => Array.isArray(c.bbox) && c.bbox.length === 4);
  noBbox += j.chunks.length - chunks.length;
  if (!chunks.length) continue;

  const keys = chunks.map((c) => c.id);
  const cases = chunks.map(() => "WHEN ? THEN ?").join(" ");
  const caseParams = chunks.flatMap((c) => [c.id, JSON.stringify(c.bbox).slice(0, 256)]);
  const inPlaceholders = chunks.map(() => "?").join(",");
  const sqlText =
    `UPDATE v2_chunks SET bbox_json = CASE chunk_key ${cases} END ` +
    `WHERE doc_id = ? AND chunk_key IN (${inPlaceholders})`;
  const params = [...caseParams, docId, ...keys];
  const [res] = await conn.execute(sqlText, params);
  updated += res.affectedRows ?? 0;
  const notFound = chunks.length - (res.affectedRows ?? 0);
  if (notFound > 0) missing += notFound;
  console.log(`↻ ${slug}: ${res.affectedRows}/${chunks.length} chunk frissítve`);
}

const [[agg]] = await conn.query(
  "SELECT COUNT(*) total, SUM(bbox_json IS NOT NULL AND bbox_json<>'') withBbox FROM v2_chunks");
await conn.end();
console.log(`\n— Dokumentum: ${docs} | frissített chunk: ${updated} | bbox nélküli (kihagyva): ${noBbox} | nem talált: ${missing}`);
console.log(`— v2_chunks összesen: ${agg.total}, ebből bbox-szal: ${agg.withBbox}`);
