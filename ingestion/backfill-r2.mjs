/**
 * R2 backfill (Node-oldal) — Fázis 4/a.
 *
 * A Python parse_all.py preview JSON-jaiban tárolt forrás-PDF-eket feltölti a
 * privát Cloudflare R2 bucketbe (kulcs: `standards/<slug>.pdf`), és beírja a
 * `v2_documents.pdf_r2_key` oszlopot. A viewer (4/b–4/c) presigned URL-t generál
 * futásidőben, ezért itt csak a tárolás és a kulcs-hivatkozás történik.
 *
 * Idempotens: ha a kulcs már be van írva ÉS az R2-ben lévő objektum mérete egyezik
 * a helyi fájléval, kihagyja. Méret-eltérésnél (frissült szabvány) újratölt.
 *
 * Futtatás a repo gyökeréből:
 *   node ingestion/backfill-r2.mjs            # minden preview
 *   node ingestion/backfill-r2.mjs --only 1992
 *   node ingestion/backfill-r2.mjs --force    # skip nélkül, mindent újratölt
 */

import "dotenv/config";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PREVIEW = path.join(HERE, "preview");

if (!process.env.TIDB_DATABASE_URL) { console.error("Nincs TIDB_DATABASE_URL."); process.exit(1); }
const accountId = process.env.R2_ACCOUNT_ID, bucket = process.env.R2_BUCKET;
if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !bucket) {
  console.error("Hiányzó R2 env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function headSize(key) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return r.ContentLength ?? null;
  } catch (e) {
    if (e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].toLowerCase() : null;
  const force = args.includes("--force");

  const conn = await mysql.createConnection({
    uri: process.env.TIDB_DATABASE_URL,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });

  let files = readdirSync(PREVIEW).filter((f) => f.endsWith(".json"));
  if (only) files = files.filter((f) => f.toLowerCase().includes(only));
  console.log(`${files.length} dokumentum feldolgozása…\n`);

  let uploaded = 0, skipped = 0, noDoc = 0, noFile = 0, fail = 0;
  for (const f of files) {
    let slug = f.replace(/\.json$/, "");
    try {
      const j = JSON.parse(readFileSync(path.join(PREVIEW, f), "utf-8"));
      const d = j.document;
      slug = d.slug;
      const src = d.source_path;
      if (!src || !existsSync(src)) { console.log(`⚠ ${slug}: forrás-PDF nincs meg (${src})`); noFile++; continue; }

      const [rowsDoc] = await conn.execute(
        "SELECT id, pdf_r2_key FROM v2_documents WHERE slug=? LIMIT 1", [slug]);
      if (!rowsDoc.length) { console.log(`⚠ ${slug}: nincs v2_documents sor (előbb ingest-v2)`); noDoc++; continue; }
      const docId = rowsDoc[0].id;
      const key = `standards/${slug}.pdf`;
      const localSize = statSync(src).size;

      if (!force && rowsDoc[0].pdf_r2_key === key) {
        const remoteSize = await headSize(key);
        if (remoteSize === localSize) { console.log(`= ${slug}: kész (${(localSize/1024).toFixed(0)} KB)`); skipped++; continue; }
      }

      const body = readFileSync(src);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body, ContentType: "application/pdf",
      }));
      await conn.execute("UPDATE v2_documents SET pdf_r2_key=? WHERE id=?", [key, docId]);
      console.log(`↑ ${slug}: feltöltve → ${key} (${(localSize/1024).toFixed(0)} KB)`);
      uploaded++;
    } catch (e) {
      console.log(`✗ ${slug}: ${e?.name || ""} — ${String(e?.message).slice(0, 140)}`);
      fail++;
    }
  }

  const [[agg]] = await conn.query(
    "SELECT COUNT(*) total, SUM(pdf_r2_key IS NOT NULL) withKey, SUM(in_force=1 AND pdf_r2_key IS NULL) forceMissing FROM v2_documents");
  await conn.end();

  console.log(`\n— Feltöltve: ${uploaded} | változatlan: ${skipped} | nincs DB-sor: ${noDoc} | nincs fájl: ${noFile} | hiba: ${fail}`);
  console.log(`— v2_documents: ${agg.total} sor, ${agg.withKey} kulccsal, ${agg.forceMissing} hatályos kulcs nélkül`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
