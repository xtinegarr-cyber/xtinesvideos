// Runs before the site starts: creates/updates the database tables and
// makes sure the admin account exists. Safe to run any number of times.
import { readFile } from "node:fs/promises";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
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

async function passwordMatches(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key, "base64url");
  const actual = await new Promise((resolve, reject) =>
    scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }, (err, k) =>
      err ? reject(err) : resolve(k),
    ),
  );
  return timingSafeEqual(expected, actual);
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

  // Once: undo the automatic titles given to earlier uploads (many were
  // just numbers). Videos go back to "<creator> video" to be named by hand,
  // and photos lose their titles (photos don't have titles). Titles typed in
  // by hand are kept: only titles that still match what the file name would
  // give are cleared. Uploads from 25 Oct 2026 on, which are titled from
  // their file names on purpose, are never touched.
  const resetDone = await client.query("SELECT 1 FROM app_settings WHERE key = 'titles_reset_to_default'");
  if (!resetDone.rows.length) {
    try {
      const { titleFromFileName } = await import(new URL("../src/lib/format.js", import.meta.url));
      const photos = (await client.query("UPDATE media SET title = NULL WHERE kind = 'image' AND title IS NOT NULL AND created_at < '2026-10-25T11:00:00Z' RETURNING id")).rows.length;
      const { rows } = await client.query(
        "SELECT id, title, original_name FROM media WHERE kind = 'video' AND title IS NOT NULL AND created_at < '2026-10-25T11:00:00Z'",
      );
      let cleared = 0;
      for (const row of rows) {
        if (titleFromFileName(row.original_name) !== row.title) continue; // named by hand: keep
        await client.query("UPDATE media SET title = NULL WHERE id = $1", [row.id]);
        cleared++;
      }
      await client.query(
        "INSERT INTO app_settings (key, value) VALUES ('titles_reset_to_default', $1) ON CONFLICT (key) DO NOTHING",
        [`${cleared} videos, ${photos} photos`],
      );
      console.log(`Cleared automatic titles: ${cleared} videos back to the default, ${photos} photo titles removed.`);
    } catch (err) {
      console.warn("Couldn't clear automatic titles (will try again next start):", err.message);
    }
  }

  // The admin's password always matches ADMIN_PASSWORD: to change it, edit
  // ADMIN_PASSWORD in Coolify and restart the site.
  const username = (process.env.ADMIN_USERNAME || "xtinegar").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const { rows } = await client.query("SELECT id, role, password_hash FROM users WHERE username = $1", [username]);
  if (!password) {
    console.warn(`ADMIN_PASSWORD is not set, so the admin account "${username}" can't be created or updated.`);
  } else if (password.length < 12) {
    console.warn(`ADMIN_PASSWORD is only ${password.length} characters. It must be at least 12, so "${username}" was not created or updated.`);
  } else if (rows.length === 0) {
    await client.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')", [
      username,
      await hashPassword(password),
    ]);
    console.log(`Created the admin account "${username}".`);
  } else {
    const user = rows[0];
    if (user.role !== "admin") {
      await client.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
      console.log(`"${username}" is now an admin.`);
    }
    if (!(await passwordMatches(password, user.password_hash))) {
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), user.id]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
      console.log(`Updated the password for "${username}" to match ADMIN_PASSWORD.`);
    } else {
      console.log(`Admin account "${username}" is ready.`);
    }
  }
} finally {
  await client.end();
}
