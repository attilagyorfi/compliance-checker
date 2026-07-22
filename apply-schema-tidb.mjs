/**
 * Drizzle migrációk alkalmazása a TiDB-re — V11.18
 *
 * A `drizzle-kit migrate` a TiDB-n némán, hibaüzenet nélkül elszáll, ezért a
 * migrációs SQL-eket közvetlenül alkalmazzuk. Így látjuk a pontos hibát, és
 * kihagyhatjuk a TiDB-n nem támogatott (vagy már meglévő) elemeket.
 *
 * Idempotens: a már létező táblákra/oszlopokra futó "already exists" hibákat
 * kihagyja, így többször is futtatható.
 *
 * Futtatás:  node apply-schema-tidb.mjs
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const URL_ = process.env.TIDB_DATABASE_URL;
if (!URL_) {
  console.error("Hiányzik a TIDB_DATABASE_URL a .env-ből.");
  process.exit(1);
}

const conn = await mysql.createConnection({
  uri: URL_,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  multipleStatements: false,
});
console.log("TiDB kapcsolat OK.\n");

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));

// Ezeket a hibákat "már megvan" néven kezeljük — idempotens újrafuttatáshoz.
const IGNORABLE = [
  "already exists",
  "Duplicate column name",
  "Duplicate key name",
  "Can't DROP",
  "check that column/key exists",
];

let applied = 0, skipped = 0, failed = 0;

for (const entry of journal.entries) {
  const file = path.join("drizzle", `${entry.tag}.sql`);
  let sqlText;
  try {
    sqlText = readFileSync(file, "utf8");
  } catch {
    console.log(`  (kihagyva, nincs fájl: ${entry.tag})`);
    continue;
  }

  const statements = sqlText
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`${entry.tag}: ${statements.length} utasítás`);
  for (const stmt of statements) {
    let clean = stmt.replace(/^\s*--.*$/gm, "").trim();
    if (!clean) continue;
    // TiDB-kompatibilitás: a JSON oszlopokhoz nem enged DEFAULT értéket
    // ("...json DEFAULT ('[]')" → szintaktikai hiba). Az alapérték elhagyása
    // funkcionálisan nem számít: az alkalmazás mindig explicit értéket ír.
    clean = clean.replace(/\bjson\s+DEFAULT\s+\('[^']*'\)/gi, "json");
    try {
      await conn.query(clean);
      applied++;
    } catch (e) {
      const msg = String(e.message);
      if (IGNORABLE.some((frag) => msg.includes(frag))) {
        skipped++;
      } else {
        failed++;
        console.error(`  HIBA: ${msg.slice(0, 200)}`);
        console.error(`    SQL: ${clean.slice(0, 160).replace(/\s+/g, " ")}…`);
      }
    }
  }
}

console.log(`\nÖsszegzés: ${applied} alkalmazva, ${skipped} kihagyva (már megvolt), ${failed} hibás.`);

const [tables] = await conn.query("SHOW TABLES");
console.log(`TiDB táblák (${tables.length}): ${tables.map((t) => Object.values(t)[0]).join(", ")}`);

await conn.end();
if (failed > 0) process.exit(1);
