// Adds a few placeholder creators so you can see the homepage layout before
// adding real ones. Run with: npm run seed:demo
// Only runs on an empty site unless you pass --force.
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const demo = [
  ["Ava Monroe", "free", 18400, 2],
  ["Luna Park", "free", 9200, 30],
  ["Sienna Vale", "free", 3100, 300],
  ["Jade Rivers", "free", 760, 500],
  ["Mila Hart", "free", 128000, 900],
  ["Nova Lane", "vip", 54000, 10],
  ["Ivy Bloom", "vip", 21700, 200],
  ["Rosa Lee", "vip", 8800, 400],
  ["Kira Sol", "vip", 1500, 700],
  ["Belle Noir", "vip", 342000, 1000],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM creators");
  if (rows[0].n > 0 && !process.argv.includes("--force")) {
    console.log("The site already has creators. Pass --force to add the demo ones anyway.");
  } else {
    for (const [name, tier, views, hoursAgo] of demo) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await client.query(
        `INSERT INTO creators (slug, name, tier, view_count, created_at)
         VALUES ($1, $2, $3, $4, now() - make_interval(hours => $5))
         ON CONFLICT (slug) DO NOTHING`,
        [slug, name, tier, views, hoursAgo],
      );
    }
    console.log(`Added ${demo.length} demo creators. Delete them from the admin panel when you're done.`);
  }
} finally {
  await client.end();
}
