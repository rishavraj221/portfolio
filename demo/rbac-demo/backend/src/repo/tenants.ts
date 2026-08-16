import type { Queryable } from "../lib/db.js";
import type { Tenant } from "../types.js";

export async function createTenant(db: Queryable, name: string, slug: string): Promise<Tenant> {
  const { rows } = await db.query<Tenant>(
    "insert into tenants (name, slug) values ($1, $2) returning *",
    [name, slug],
  );
  const tenant = rows[0];
  if (!tenant) throw new Error("failed to create tenant");
  return tenant;
}

export async function getTenantById(db: Queryable, tenantId: string): Promise<Tenant | null> {
  const { rows } = await db.query<Tenant>("select * from tenants where id = $1", [tenantId]);
  return rows[0] ?? null;
}

export async function listTenants(db: Queryable): Promise<Tenant[]> {
  const { rows } = await db.query<Tenant>("select * from tenants order by created_at asc");
  return rows;
}

// The only mutation of policy_version. Every role assignment/revocation
// routes through here so a stale token can be detected on the next request.
export async function bumpPolicyVersion(db: Queryable, tenantId: string): Promise<number> {
  const { rows } = await db.query<{ policy_version: number }>(
    "update tenants set policy_version = policy_version + 1 where id = $1 returning policy_version",
    [tenantId],
  );
  const row = rows[0];
  if (!row) throw new Error(`tenant ${tenantId} not found`);
  return row.policy_version;
}
