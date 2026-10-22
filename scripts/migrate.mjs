// Runs before the site starts: creates/updates the database tables and
// makes sure the admin account exists. Safe to run any number of times.
import { readFile } from "node:fs/promises";
import { randomBytes, scrypt } from "node:crypto";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file: environment variables come from the host (e.g. Coolify).
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set, so the database can't be prepared.");
  process.exit(1);
}

// Same format as src/lib/passwords.js
function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", 16384, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$")),
    ),
  );
}

async function connect() {
  // The database container can take a few seconds to start on deploy.
  for (let attempt = 1; ; attempt++) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      if (attempt >= 30) throw err;
      console.log(`Waiting for the database (${err.message})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const client = await connect();
try {
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await client.query(schema);
  console.log("Database tables are ready.");

  const username = (process.env.ADMIN_USERNAME || "xtinegar").trim().toLowerCase();
  const { rows } = await client.query("SELECT id, role FROM users WHERE username = $1", [username]);
  if (rows.length === 0) {
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(`No admin account yet. Set ADMIN_PASSWORD and restart to create "${username}".`);
    } else if (process.env.ADMIN_PASSWORD.length < 12) {
      console.warn("ADMIN_PASSWORD must be at least 12 characters. The admin account was not created.");
    } else {
      await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')", [
        username,
        await hashPassword(process.env.ADMIN_PASSWORD),
      ]);
      console.log(`Created the admin account "${username}".`);
    }
  } else if (rows[0].role !== "admin") {
    await client.query("UPDATE users SET role = 'admin' WHERE id = $1", [rows[0].id]);
    console.log(`"${username}" is now an admin.`);
  }
} finally {
  await client.end();
}
