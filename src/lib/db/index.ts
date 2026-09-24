import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

export type DB = ReturnType<typeof getDb>;

export function getDb(d1: D1Database = env.DB) {
  return drizzle(d1, { schema });
}

export { schema };
