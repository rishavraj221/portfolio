import { pool } from "../lib/db.js";

// Login accepts either a tenant slug or id since the demo UI works off slugs
// but internal callers pass ids -- this is the one place that ambiguity is resolved.
export async function resolveTenantIdentifier(slugOrId: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    "select id from tenants where id::text = $1 or slug = $1",
    [slugOrId],
  );
  return rows[0]?.id ?? null;
}
