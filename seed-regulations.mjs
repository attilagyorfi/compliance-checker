/**
 * Seed script: inserts downloaded Hungarian regulations into regulation_sources table.
 * Run with: node seed-regulations.mjs
 */
import { readFileSync } from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Read downloaded regulation files
const otsz = readFileSync("/tmp/otsz_full.md", "utf8");
const otek = readFileSync("/tmp/otek_full.md", "utf8");
const epkiv = readFileSync("/tmp/epkiv_full.md", "utf8");
const etv = readFileSync("/tmp/etv_full.md", "utf8");

// MySQL TEXT column limit is 65535 bytes. We'll truncate to 60000 chars to be safe.
const truncate = (text, maxLen = 60000) => text.slice(0, maxLen);

const regulations = [
  {
    name: "54/2014. (XII. 5.) BM rendelet – Országos Tűzvédelmi Szabályzat (OTSZ)",
    shortCode: "OTSZ",
    discipline: "tuzvedelmi",
    sourceType: "njt",
    sourceUrl: "https://njt.hu/jogszabaly/2014-54-20-0A",
    content: truncate(otsz),
    syncStatus: "ok",
    version: "2025-09-23",
    isActive: true,
  },
  {
    name: "253/1997. (XII. 20.) Korm. rendelet – Országos Településrendezési és Építési Követelmények (OTÉK)",
    shortCode: "OTÉK",
    discipline: "epiteszet",
    sourceType: "njt",
    sourceUrl: "https://njt.hu/jogszabaly/1997-253-20-22",
    content: truncate(otek),
    syncStatus: "ok",
    version: "2024-01-01",
    isActive: true,
  },
  {
    name: "312/2012. (XI. 8.) Korm. rendelet – Építésügyi és építésfelügyeleti hatósági eljárások",
    shortCode: "Épkiv",
    discipline: "altalanos",
    sourceType: "njt",
    sourceUrl: "https://njt.hu/jogszabaly/2012-312-20-22",
    content: truncate(epkiv),
    syncStatus: "ok",
    version: "2024-08-16",
    isActive: true,
  },
  {
    name: "1997. évi LXXVIII. törvény – Az épített környezet alakításáról és védelméről (Étv.)",
    shortCode: "Étv.",
    discipline: "altalanos",
    sourceType: "njt",
    sourceUrl: "https://njt.hu/jogszabaly/1997-78-00-00",
    content: truncate(etv),
    syncStatus: "ok",
    version: "2024-09-01",
    isActive: true,
  },
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("Connected to DB");

  for (const reg of regulations) {
    // Check if already exists by shortCode
    const [existing] = await conn.execute(
      "SELECT id FROM regulation_sources WHERE shortCode = ? LIMIT 1",
      [reg.shortCode]
    );
    if (existing.length > 0) {
      // Update content
      await conn.execute(
        `UPDATE regulation_sources SET 
          name = ?, content = ?, sourceUrl = ?, syncStatus = ?, version = ?, contentFetchedAt = NOW(), lastSyncAt = NOW()
         WHERE shortCode = ?`,
        [reg.name, reg.content, reg.sourceUrl, reg.syncStatus, reg.version, reg.shortCode]
      );
      console.log(`✓ Updated: ${reg.shortCode} (${reg.content.length} chars)`);
    } else {
      // Insert new
      await conn.execute(
        `INSERT INTO regulation_sources 
          (name, shortCode, discipline, sourceType, sourceUrl, content, syncStatus, version, contentFetchedAt, lastSyncAt, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
        [reg.name, reg.shortCode, reg.discipline, reg.sourceType, reg.sourceUrl, reg.content, reg.syncStatus, reg.version, reg.isActive ? 1 : 0]
      );
      console.log(`✓ Inserted: ${reg.shortCode} (${reg.content.length} chars)`);
    }
  }

  await conn.end();
  console.log("\nAll regulations seeded successfully!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
