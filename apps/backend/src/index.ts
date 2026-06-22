import { createApp } from "./app";
import { env } from "./env";
import { pool } from "./db";

/** Process entry point: start the HTTP server and handle graceful shutdown. */
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[odj-backend] listening on http://localhost:${env.PORT}`);
  console.log(`[odj-backend]   liveness:  GET /api/health`);
  console.log(`[odj-backend]   readiness: GET /api/health/db`);
  console.log(`[odj-backend]   auth:      ALL /api/auth/*`);
});

async function shutdown(signal: string) {
  console.log(`\n[odj-backend] ${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
