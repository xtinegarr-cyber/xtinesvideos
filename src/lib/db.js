import pg from "pg";

// One connection pool per server process (kept on globalThis so hot reload
// in development doesn't open a new pool on every edit).
function pool() {
  if (!globalThis.__xvPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Add it to your environment variables.");
    }
    globalThis.__xvPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_SIZE) || 10,
    });
    // When the database restarts (an update, a Coolify redeploy), idle
    // connections are dropped. Without this listener that error would
    // crash the whole site; with it, the pool just opens new connections.
    globalThis.__xvPool.on("error", (err) => console.error("Database connection dropped:", err.message));
  }
  return globalThis.__xvPool;
}

export async function query(text, params = []) {
  const { rows } = await pool().query(text, params);
  return rows;
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}
