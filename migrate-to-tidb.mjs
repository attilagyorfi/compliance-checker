/**
 * Migrálás TiDB Cloud-ba — V11.18
 *
 * A lokál MySQL tartalmát (20 szabvány + 5693 chunk-embedding) átmásolja a
 * felhő-adatbázisba, és felkészíti a DB-oldali vektor-keresésre:
 *   - `embedding_vec VECTOR(1536)` oszlop (a TiDB natív vektor-típusa)
 *   - opcionális HNSW vektor-index (ha a tier támogatja — enélkül is működik)
 *
 * Előfeltételek:
 *   1) .env: TIDB_DATABASE_URL=mysql://user:pass@host:4000/db?ssl={"rejectUnauthorized":true}
 *   2) A séma már fent van a TiDB-n:  npm run db:push:tidb
 *   3) Fut a lokál MySQL (forrás):    docker compose up -d
 *
 * Futtatás:  node migrate-to-tidb.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { execSync } from "node:child_process";

const SRC_URL = process.env.DATABASE_URL;
const DST_URL = process.env.TIDB_DATABASE_URL;

if (!DST_URL) {
  console.error("Hiányzik a TIDB_DATABASE_URL a .env-ből.");
  process.exit(1);
}
if (!SRC_URL) {
  console.error("Hiányzik a DATABASE_URL (forrás, lokál MySQL) a .env-ből.");
  process.exit(1);
}

// ── 0. Séma felvitele a TiDB-re (drizzle migrációk) ───────────────────────────
// Ugyanazok a migrációk futnak, mint lokálisan; a DATABASE_URL-t ideiglenesen a
// TiDB-re irányítjuk. Idempotens: a már alkalmazott migrációkat kihagyja.
console.log("Séma felvitele a TiDB-re (drizzle-kit migrate)…");
try {
  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: DST_URL },
  });
} catch {
  console.error("A drizzle-kit migrate hibára futott — ellenőrizd a TIDB_DATABASE_URL-t.");
  process.exit(1);
}

const src = await mysql.createConnection(SRC_URL).catch((e) => {
  console.error("A lokál MySQL nem elérhető (forrás). Indítsd el: docker compose up -d");
  console.error(String(e.message).slice(0, 120));
  process.exit(1);
});
const dst = await mysql.createConnection(DST_URL).catch((e) => {
  console.error("A TiDB nem elérhető. Ellenőrizd a TIDB_DATABASE_URL-t (SSL kötelező).");
  console.error(String(e.message).slice(0, 160));
  process.exit(1);
});

console.log("Kapcsolat OK (forrás + cél).\n");

// ── 1. Vektor-oszlop előkészítése a célban ────────────────────────────────────
async function ensureVectorColumn() {
  const [cols] = await dst.query("SHOW COLUMNS FROM chunk_embeddings LIKE 'embedding_vec'");
  if (cols.length > 0) {
    console.log("embedding_vec oszlop már létezik.");
    return true;
  }
  try {
    await dst.query("ALTER TABLE chunk_embeddings ADD COLUMN embedding_vec VECTOR(1536) NULL");
    console.log("embedding_vec VECTOR(1536) oszlop létrehozva.");
    return true;
  } catch (e) {
    console.warn("A VECTOR oszlop nem hozható létre — a cél DB nem támogatja a vektor-típust.");
    console.warn("  " + String(e.message).slice(0, 140));
    console.warn("  A migrálás folytatódik; a kereső a JS-oldali fallbackre vált (lassabb).");
    return false;
  }
}

async function tryCreateVectorIndex() {
  try {
    await dst.query(
      "ALTER TABLE chunk_embeddings ADD VECTOR INDEX idx_chunk_emb_cos ((VEC_COSINE_DISTANCE(embedding_vec))) USING HNSW"
    );
    console.log("HNSW vektor-index létrehozva.");
  } catch (e) {
    // 5693 sornál index nélkül is gyors a DB-oldali keresés — nem blokkoló.
    console.log("Vektor-index kihagyva (nem kötelező): " + String(e.message).slice(0, 90));
  }
}

const hasVector = await ensureVectorColumn();

// ── 2. regulation_sources átmásolása ──────────────────────────────────────────
const [srcSources] = await src.query("SELECT * FROM regulation_sources");
console.log(`\nForrás: ${srcSources.length} szabvány.`);

const idMap = new Map(); // régi id → új id
let copiedSources = 0, skippedSources = 0;

for (const s of srcSources) {
  const [exists] = await dst.execute("SELECT id FROM regulation_sources WHERE name = ? LIMIT 1", [s.name]);
  if (exists.length > 0) {
    idMap.set(s.id, exists[0].id);
    skippedSources++;
    continue;
  }
  const [ins] = await dst.execute(
    `INSERT INTO regulation_sources
       (name, shortCode, discipline, sourceType, sourceUrl, content, contentFetchedAt,
        lastSyncAt, syncStatus, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.name, s.shortCode, s.discipline, s.sourceType, s.sourceUrl,
      s.content, s.contentFetchedAt, s.lastSyncAt, s.syncStatus ?? "ok",
      s.isActive ?? 1, s.createdAt ?? new Date(), s.updatedAt ?? new Date(),
    ]
  );
  idMap.set(s.id, ins.insertId);
  copiedSources++;
  console.log(`  + ${s.name.slice(0, 52)}`);
}
console.log(`Szabványok: ${copiedSources} másolva, ${skippedSources} már megvolt.`);

// ── 3. chunk_embeddings átmásolása (kötegelve) ────────────────────────────────
const [[{ n: srcChunks }]] = await src.query(
  "SELECT COUNT(*) n FROM chunk_embeddings WHERE source_type='regulation'"
);
const [[{ n: dstChunks }]] = await dst.query(
  "SELECT COUNT(*) n FROM chunk_embeddings WHERE source_type='regulation'"
);
console.log(`\nChunk-embeddingek: forrás ${srcChunks}, cél ${dstChunks}.`);

if (dstChunks >= srcChunks && srcChunks > 0) {
  console.log("A cél már tartalmazza az embeddingeket — másolás kihagyva.");
} else {
  if (dstChunks > 0) {
    await dst.query("DELETE FROM chunk_embeddings WHERE source_type='regulation'");
    console.log("Részleges cél-adat törölve, tiszta másolás indul.");
  }
  const PAGE = 200;
  let done = 0;
  for (let offset = 0; ; offset += PAGE) {
    const [rows] = await src.query(
      "SELECT source_id, chunk_index, text, embedding FROM chunk_embeddings WHERE source_type='regulation' ORDER BY id LIMIT ? OFFSET ?",
      [PAGE, offset]
    );
    if (rows.length === 0) break;

    const values = [];
    const params = [];
    for (const r of rows) {
      const newSourceId = idMap.get(r.source_id);
      if (!newSourceId) continue;
      const embJson = typeof r.embedding === "string" ? r.embedding : JSON.stringify(r.embedding);
      if (hasVector) {
        values.push("('regulation', ?, ?, ?, ?, ?, NOW())");
        params.push(newSourceId, r.chunk_index, r.text, embJson, embJson);
      } else {
        values.push("('regulation', ?, ?, ?, ?, NOW())");
        params.push(newSourceId, r.chunk_index, r.text, embJson);
      }
    }
    if (values.length === 0) continue;

    const cols = hasVector
      ? "(source_type, source_id, chunk_index, text, embedding, embedding_vec, created_at)"
      : "(source_type, source_id, chunk_index, text, embedding, created_at)";
    await dst.execute(`INSERT INTO chunk_embeddings ${cols} VALUES ${values.join(", ")}`, params);

    done += rows.length;
    process.stdout.write(`\r  másolva: ${done}/${srcChunks}`);
  }
  console.log("\nChunk-embeddingek átmásolva.");
}

// ── 4. Vektor-index (opcionális) + ellenőrzés ─────────────────────────────────
if (hasVector) {
  await tryCreateVectorIndex();
  try {
    const [[chk]] = await dst.query(
      "SELECT COUNT(*) AS n FROM chunk_embeddings WHERE embedding_vec IS NOT NULL"
    );
    console.log(`Vektor-oszlop feltöltve: ${chk.n} sor.`);
  } catch { /* ignore */ }
}

const [[a]] = await dst.query("SELECT COUNT(*) n FROM regulation_sources");
const [[b]] = await dst.query("SELECT COUNT(*) n FROM chunk_embeddings");
console.log(`\nKÉSZ. TiDB állapot: ${a.n} szabvány, ${b.n} chunk-embedding.`);

await src.end();
await dst.end();
