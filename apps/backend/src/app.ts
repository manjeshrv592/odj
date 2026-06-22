import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { env } from "./env";
import { healthRouter } from "./routes/health";

/**
 * Build the Express application. Kept separate from server startup so it can be
 * imported in tests without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: [env.WEB_ORIGIN],
      credentials: true,
    }),
  );

  // better-auth mounts its own handler and parses its own request body, so it
  // MUST be registered before express.json(). Express 5 requires a named
  // wildcard — `{*any}` matches /api/auth and everything beneath it.
  app.all("/api/auth/{*any}", toNodeHandler(auth));

  // JSON body parsing for all other routes.
  app.use(express.json());

  app.use("/api/health", healthRouter);

  app.get("/", (_req: Request, res: Response) => {
    res.json({ name: "odj-backend", status: "ok" });
  });

  return app;
}
