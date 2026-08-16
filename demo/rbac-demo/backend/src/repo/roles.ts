import type { Queryable } from "../lib/db.js";
import type { Role } from "../types.js";
import { requireTenantId } from "./tenantScoped.js";

export async function createRole(
  db: Queryable,
  tenantId: string | undefined,
  name: string,
): Promise<Role> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Role>(
    "insert into roles (tenant_id, name, is_system) values ($1, $2, false) returning *",
    [tid, name],
  );
  const role = rows[0];
  if (!role) throw new Error("failed to create role");
  return role;
}

export async function createSystemRole(db: Queryable, name: string): Promise<Role> {
  const { rows } = await db.query<Role>(
    "insert into roles (tenant_id, name, is_system) values (null, $1, true) returning *",
    [name],
  );
  const role = rows[0];
  if (!role) throw new Error("failed to create system role");
  return role;
}

// System roles (tenant_id null) plus this tenant's custom roles -- both are
// assignable within a tenant, which is why the union rather than a strict filter.
export async function listRolesForTenant(
  db: Queryable,
  tenantId: string | undefined,
): Promise<Role[]> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Role>(
    "select * from roles where tenant_id = $1 or tenant_id is null order by is_system desc, name asc",
    [tid],
  );
  return rows;
}

export async function getRoleById(db: Queryable, roleId: string): Promise<Role | null> {
  const { rows } = await db.query<Role>("select * from roles where id = $1", [roleId]);
  return rows[0] ?? null;
}

export async function setRolePermissions(
  db: Queryable,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  await db.query("delete from role_permissions where role_id = $1", [roleId]);
  for (const permissionId of permissionIds) {
    await db.query("insert into role_permissions (role_id, permission_id) values ($1, $2)", [
      roleId,
      permissionId,
    ]);
  }
}

export async function listPermissionsForRole(db: Queryable, roleId: string): Promise<string[]> {
  const { rows } = await db.query<{ key: string }>(
    `select p.key from role_permissions rp join permissions p on p.id = rp.permission_id where rp.role_id = $1`,
    [roleId],
  );
  return rows.map((r) => r.key);
}
