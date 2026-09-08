/**
 * V2 betöltő (Node-oldal) — Fázis 1 (hibrid felállás).
 *
 * A Python parse_all.py által előállított strukturált JSON-okat (ingestion/preview/)
 * betölti a TiDB v2_* tábláiba, és a megjelenítési egységekből (teljes bekezdés)
 * átfedő KERESÉSI ablakokat képez, mindegyikhez embeddinggel (OpenAI) → v2_embeddings
 * (VECTOR oszlop). A mysql2 + fetch bizonyítottan működik ebben a környezetben
 * (a Python socket-je a 4000-es TiDB-porton tiltott).
 *
 * A legacy sémát NEM érinti. Idempotens: checksum-alapú skip; változásnál újraír.
 *
 * Futtatás a repo gyökeréből:
 *   node ingestion/ingest-v2.mjs                # minden JSON
 *   node ingestion/ingest-v2.mjs --only 1992    # slug-szűrés
 *   node ingestion/ingest-v2.mjs --schema-only
 */

import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PREVIEW = path.join(HERE, "preview");
const KEY = process.env.OPENAI_API_KEY;
const BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const EMB_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const WINDOW = 1000, OVERLAP = 150;

if (!process.env.TIDB_DATABASE_URL) { console.error("Nincs TIDB_DATABASE_URL."); process.exit(1); }
if (!KEY) { console.error("Nincs OPENAI_API_KEY."); process.exit(1); }

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS v2_documents (
    id INT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(128) NOT NULL UNIQUE,
    title VARCHAR(512) NOT NULL, official_id VARCHAR(128), edition_year INT NULL,
    page_count INT, page_offset INT DEFAULT 0, offset_confidence FLOAT DEFAULT 0,
    has_text_layer TINYINT(1) DEFAULT 1, checksum VARCHAR(64), pdf_r2_key VARCHAR(512) NULL,
    in_force TINYINT(1) DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS v2_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY, doc_id INT NOT NULL, node_key VARCHAR(256) NOT NULL,
    node_type VARCHAR(32), number VARCHAR(64), heading VARCHAR(512), depth INT,
    pdf_page INT, printed_page INT NULL, breadcrumb VARCHAR(1024), order_index INT,
    KEY idx_v2nodes_doc (doc_id))`,
  `CREATE TABLE IF NOT EXISTS v2_chunks (
    id INT AUTO_INCREMENT PRIMARY KEY, doc_id INT NOT NULL, node_key VARCHAR(256) NULL,
    chunk_key VARCHAR(256) NOT NULL, unit VARCHAR(16), clause_no VARCHAR(16) NULL,
    breadcrumb VARCHAR(1024), text MEDIUMTEXT NOT NULL, pdf_page INT, printed_page INT NULL,
    bbox_json VARCHAR(256) NULL, char_len INT, order_index INT, KEY idx_v2chunks_doc (doc_id))`,
  `CREATE TABLE IF NOT EXISTS v2_embeddings (
    id INT AUTO_INCREMENT PRIMARY KEY, chunk_id INT NOT NULL, doc_id INT NOT NULL,
    window_index INT, text TEXT NOT NULL, embedding_vec VECTOR(1536),
    KEY idx_v2emb_chunk (chunk_id), KEY idx_v2emb_doc (doc_id))`,
];

function windows(text) {
  text = (text || "").trim();
  if (text.length <= WINDOW) return text ? [text] : [];
  const out = [];
  let s = 0;
  while (s < text.length) {
    out.push(text.slice(s, s + WINDOW));
    s += WINDOW - OVERLAP;
    if (s + OVERLAP >= text.length) break;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function embedBatch(inputs, attempt = 1) {
  try {
    const r = await fetch(`${BASE}/v1/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: EMB_MODEL, input: inputs }),
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`);
    const j = await r.json();
    return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (e) {
    if (attempt >= 4) throw e;
    await sleep(1000 * 2 ** (attempt - 1));
    return embedBatch(inputs, attempt + 1);
  }
}
async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) out.push(...await embedBatch(texts.slice(i, i + 100)));
  return out;
}

async function ingestDoc(conn, json) {
  const d = json.document;
  const [ex] = await conn.execute("SELECT id, checksum FROM v2_documents WHERE slug=? LIMIT 1", [d.slug]);
  let docId;
  if (ex.length && ex[0].checksum === d.checksum) {
    console.log(`  skip (változatlan): ${d.official_id}`);
    return "skip";
  }
  if (ex.length) {
    docId = ex[0].id;
    for (const t of ["v2_embeddings", "v2_chunks", "v2_nodes"]) {
      await conn.execute(`DELETE FROM ${t} WHERE doc_id=?`, [docId]);
    }
    await conn.execute(
      `UPDATE v2_documents SET title=?, official_id=?, edition_year=?, page_count=?,
       page_offset=?, offset_confidence=?, checksum=? WHERE id=?`,
      [d.title, d.official_id, d.edition_year ?? null, d.page_count, d.printed_offset,
       d.offset_confidence, d.checksum, docId]);
  } else {
    const [ins] = await conn.execute(
      `INSERT INTO v2_documents (slug, title, official_id, edition_year, page_count,
       page_offset, offset_confidence, checksum) VALUES (?,?,?,?,?,?,?,?)`,
      [d.slug, d.title, d.official_id, d.edition_year ?? null, d.page_count,
       d.printed_offset, d.offset_confidence, d.checksum]);
    docId = ins.insertId;
  }

  // csomópontok — kötegelt insert
  if (json.nodes.length) {
    const ph = json.nodes.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
    const params = [];
    json.nodes.forEach((n, i) => params.push(
      docId, n.id, n.type, n.number, (n.heading || "").slice(0, 512), n.depth,
      n.pdf_page, n.printed_page, (n.breadcrumb || "").slice(0, 1024), i));
    // 500-as darabokban, hogy ne legyen túl nagy a lekérdezés
    for (let i = 0; i < json.nodes.length; i += 500) {
      const slice = json.nodes.slice(i, i + 500);
      const sp = slice.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
      const spar = [];
      slice.forEach((n, j) => spar.push(
        docId, n.id, n.type, n.number, (n.heading || "").slice(0, 512), n.depth,
        n.pdf_page, n.printed_page, (n.breadcrumb || "").slice(0, 1024), i + j));
      await conn.query(`INSERT INTO v2_nodes (doc_id, node_key, node_type, number, heading, depth, pdf_page, printed_page, breadcrumb, order_index) VALUES ${sp}`, spar);
    }
  }

  // egységek — kötegelt insert, majd id-k visszaolvasása order_index szerint
  for (let i = 0; i < json.chunks.length; i += 300) {
    const slice = json.chunks.slice(i, i + 300);
    const sp = slice.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const spar = [];
    slice.forEach((c, j) => spar.push(
      docId, c.node_number ?? null, c.id, c.unit, c.clause_no ?? null,
      (c.breadcrumb || "").slice(0, 1024), c.text, c.pdf_page, c.printed_page,
      JSON.stringify(c.bbox ?? null).slice(0, 256), c.text.length, i + j));
    await conn.query(`INSERT INTO v2_chunks (doc_id, node_key, chunk_key, unit, clause_no, breadcrumb, text, pdf_page, printed_page, bbox_json, char_len, order_index) VALUES ${sp}`, spar);
  }
  const [chunkRows] = await conn.query("SELECT id, order_index FROM v2_chunks WHERE doc_id=?", [docId]);
  const idByOrder = new Map(chunkRows.map((r) => [r.order_index, r.id]));

  // kereső-ablakok + embedding
  const winTexts = [], winMeta = [];
  json.chunks.forEach((c, i) => {
    const cid = idByOrder.get(i);
    windows(c.text).forEach((w, wi) => { winTexts.push(w); winMeta.push([cid, wi]); });
  });
  const vecs = winTexts.length ? await embedAll(winTexts) : [];
  for (let i = 0; i < winMeta.length; i += 200) {
    const meta = winMeta.slice(i, i + 200);
    const sp = meta.map(() => "(?,?,?,?,?)").join(",");
    const spar = [];
    meta.forEach(([cid, wi], j) => spar.push(
      cid, docId, wi, winTexts[i + j].slice(0, 65000), JSON.stringify(vecs[i + j])));
    await conn.query(`INSERT INTO v2_embeddings (chunk_id, doc_id, window_index, text, embedding_vec) VALUES ${sp}`, spar);
  }

  console.log(`  OK: ${d.official_id} | ${json.nodes.length} csomópont, ${json.chunks.length} egység, ${winTexts.length} kereső-ablak`);
  return "done";
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].toLowerCase() : null;
  const schemaOnly = args.includes("--schema-only");

  const conn = await mysql.createConnection({
    uri: process.env.TIDB_DATABASE_URL,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  for (const s of SCHEMA) await conn.query(s);
  console.log("v2 séma kész.");
  if (schemaOnly) { await conn.end(); return; }

  let files = readdirSync(PREVIEW).filter((f) => f.endsWith(".json"));
  if (only) files = files.filter((f) => f.toLowerCase().includes(only));
  console.log(`${files.length} JSON betöltése…`);

  let done = 0, skip = 0, fail = 0;
  for (const f of files) {
    try {
      const json = JSON.parse(readFileSync(path.join(PREVIEW, f), "utf-8"));
      const r = await ingestDoc(conn, json);
      if (r === "done") done++; else skip++;
    } catch (e) {
      fail++;
      console.error(`  HIBA: ${f} → ${String(e.message ?? e).slice(0, 140)}`);
    }
  }
  const [[a]] = await conn.query("SELECT COUNT(*) n FROM v2_documents");
  const [[b]] = await conn.query("SELECT COUNT(*) n FROM v2_chunks");
  const [[c]] = await conn.query("SELECT COUNT(*) n FROM v2_embeddings");
  await conn.end();
  console.log(`\nKész. ${done} feldolgozva, ${skip} kihagyva, ${fail} hibás.`);
  console.log(`TiDB v2: ${a.n} dokumentum, ${b.n} egység, ${c.n} kereső-embedding.`);
}

main();
