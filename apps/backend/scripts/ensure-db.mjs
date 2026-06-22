// Idempotently ensure the target database (from DATABASE_URL) exists.
// Connects to the `postgres` maintenance DB and CREATE DATABASE if missing.
// Run via: node --env-file=../../.env apps/backend/scripts/ensure-db.mjs
import pg from "pg";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const url = new URL(raw);
const target = decodeURIComponent(url.pathname.replace(/^\//, "")) || "odj";
url.pathname = "/postgres";

const client = new pg.Client({ connectionString: url.toString() });
try {
  await client.connect();
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [target],
  );
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${target}"`);
    console.log(`[ensure-db] created database "${target}"`);
  } else {
    console.log(`[ensure-db] database "${target}" already exists`);
  }
} catch (err) {
  console.error(`[ensure-db] failed: ${err.message}`);
  process.exit(1);
} finally {
  await client.end();
}
