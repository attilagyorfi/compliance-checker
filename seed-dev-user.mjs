/**
 * Lokális dev felhasználó seed.
 * Futtatás: `node seed-dev-user.mjs`
 *
 * Csak DEV-re — .env-ből veszi a DATABASE_URL-t és létrehoz egy admin
 * szerepkörű felhasználót. Ha már van ilyen openId-jű user, csak a role-t
 * frissíti. A returned ID-t használd a `.env` LOCAL_DEV_USER_ID értékéhez.
 */

import mysql from "mysql2/promise";
import "dotenv/config";

const DEV_USER = {
  openId: "local-dev-user",
  name: "Helyi Fejlesztő",
  email: "dev@localhost",
  loginMethod: "local-dev",
  role: "admin",
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Hiba: DATABASE_URL nincs beállítva a .env-ben.");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);

  try {
    // Megnézzük, létezik-e már
    const [rows] = await conn.execute(
      "SELECT id, role FROM users WHERE openId = ? LIMIT 1",
      [DEV_USER.openId],
    );

    let id;
    if (rows.length > 0) {
      id = rows[0].id;
      await conn.execute(
        "UPDATE users SET name=?, email=?, loginMethod=?, role=? WHERE id=?",
        [DEV_USER.name, DEV_USER.email, DEV_USER.loginMethod, DEV_USER.role, id],
      );
      console.log(`[seed-dev-user] Meglévő user frissítve. ID: ${id}, role: ${DEV_USER.role}`);
    } else {
      const [result] = await conn.execute(
        "INSERT INTO users (openId, name, email, loginMethod, role) VALUES (?, ?, ?, ?, ?)",
        [DEV_USER.openId, DEV_USER.name, DEV_USER.email, DEV_USER.loginMethod, DEV_USER.role],
      );
      id = result.insertId;
      console.log(`[seed-dev-user] Új user létrehozva. ID: ${id}`);
    }

    console.log(`\nA .env-be állítsd be:\n  LOCAL_DEV_USER_ID=${id}\n`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[seed-dev-user] hiba:", err);
  process.exit(1);
});
