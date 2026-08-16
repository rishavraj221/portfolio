import type { Queryable } from "../lib/db.js";
import type { ServiceClient } from "../types.js";
import { requireTenantId } from "./tenantScoped.js";

export async function createServiceClient(
  db: Queryable,
  tenantId: string | undefined,
  clientId: string,
  secretHash: string,
  name: string,
): Promise<ServiceClient> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<ServiceClient>(
    "insert into service_clients (tenant_id, client_id, secret_hash, name) values ($1, $2, $3, $4) returning *",
    [tid, clientId, secretHash, name],
  );
  const client = rows[0];
  if (!client) throw new Error("failed to create service client");
  return client;
}

// Lookup is by client_id (globally unique) rather than tenant-scoped, since
// at auth time we don't yet know the tenant -- the row itself carries it.
export async function getServiceClientByClientId(
  db: Queryable,
  clientId: string,
): Promise<ServiceClient | null> {
  const { rows } = await db.query<ServiceClient>("select * from service_clients where client_id = $1", [
    clientId,
  ]);
  return rows[0] ?? null;
}

export async function setServiceClientScopes(
  db: Queryable,
  serviceClientId: string,
  permissionIds: string[],
): Promise<void> {
  await db.query("delete from service_client_scopes where service_client_id = $1", [serviceClientId]);
  for (const permissionId of permissionIds) {
    await db.query(
      "insert into service_client_scopes (service_client_id, permission_id) values ($1, $2)",
      [serviceClientId, permissionId],
    );
  }
}

export async function listScopesForServiceClient(
  db: Queryable,
  serviceClientId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ key: string }>(
    `select p.key from service_client_scopes scs
     join permissions p on p.id = scs.permission_id
     where scs.service_client_id = $1`,
    [serviceClientId],
  );
  return rows.map((r) => r.key);
}
