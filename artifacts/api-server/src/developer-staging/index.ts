import pg from "pg";
import { createStagingRouter } from "./router.js";
import { StagingRepository } from "./repository.js";

// This module is omitted from agency-release builds. Even in a developer
// build, activating it in production is forbidden.
if (process.env.NODE_ENV === "production") throw new Error("Synthetic staging cannot run in production.");
if (!process.env.DATABASE_URL) throw new Error("Synthetic staging requires a development PostgreSQL connection.");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, max: 4,
  connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000,
});
export default createStagingRouter(new StagingRepository(pool));
