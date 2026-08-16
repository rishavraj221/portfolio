import type { Queryable } from "../lib/db.js";
import type { Membership, MembershipContext, Tenant } from "../types.js";
import { requireTenantId } from "./tenantScoped.js";

export async function createMembership(
  db: Queryable,
  tenantId: string | undefined,
  userId: string,
): Promise<Membership> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Membership>(
    "insert into memberships (tenant_id, user_id) values ($1, $2) returning *",
    [tid, userId],
  );
  const membership = rows[0];
  if (!membership) throw new Error("failed to create membership");
  return membership;
}

export async function getMembership(
  db: Queryable,
  tenantId: string | undefined,
  userId: string,
): Promise<Membership | null> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Membership>(
    "select * from memberships where tenant_id = $1 and user_id = $2",
    [tid, userId],
  );
  return rows[0] ?? null;
}

export async function listMembershipsForTenant(
  db: Queryable,
  tenantId: string | undefined,
): Promise<Membership[]> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Membership>(
    "select * from memberships where tenant_id = $1 order by created_at asc",
    [tid],
  );
  return rows;
}

// All tenants a user belongs to, with their roles/permissions in each --
// this is the one cross-tenant read the model allows, since it's keyed by
// user_id (who the caller already is) rather than by an unfiltered scan.
export async function listMembershipContextsForUser(
  db: Queryable,
  userId: string,
): Promise<MembershipContext[]> {
  const { rows: memberships } = await db.query<Membership & Tenant>(
    `select m.id, m.tenant_id, m.user_id, m.created_at,
            t.name as tenant_name, t.slug as tenant_slug, t.policy_version as tenant_policy_version
     from memberships m
     join tenants t on t.id = m.tenant_id
     where m.user_id = $1`,
    [userId],
  );

  const contexts: MembershipContext[] = [];
  for (const row of memberships) {
    const { rows: roleRows } = await db.query<{ name: string }>(
      `select r.name from membership_roles mr
       join roles r on r.id = mr.role_id
       where mr.membership_id = $1`,
      [row.id],
    );
    const { rows: permRows } = await db.query<{ key: string }>(
      `select distinct p.key from membership_roles mr
       join role_permissions rp on rp.role_id = mr.role_id
       join permissions p on p.id = rp.permission_id
       where mr.membership_id = $1`,
      [row.id],
    );

    contexts.push({
      tenant: {
        id: row.tenant_id,
        name: (row as unknown as { tenant_name: string }).tenant_name,
        slug: (row as unknown as { tenant_slug: string }).tenant_slug,
        policy_version: (row as unknown as { tenant_policy_version: number }).tenant_policy_version,
        created_at: row.created_at,
      },
      membership: { id: row.id, tenant_id: row.tenant_id, user_id: row.user_id, created_at: row.created_at },
      roles: roleRows.map((r) => r.name),
      permissions: permRows.map((p) => p.key),
    });
  }
  return contexts;
}

export async function listMembershipsWithEmailForTenant(
  db: Queryable,
  tenantId: string | undefined,
): Promise<(Membership & { email: string; roles: string[] })[]> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Membership & { email: string }>(
    `select m.*, u.email from memberships m join users u on u.id = m.user_id where m.tenant_id = $1 order by u.email asc`,
    [tid],
  );
  const withRoles = [];
  for (const row of rows) {
    const { rows: roleRows } = await db.query<{ name: string }>(
      `select r.name from membership_roles mr join roles r on r.id = mr.role_id where mr.membership_id = $1`,
      [row.id],
    );
    withRoles.push({ ...row, roles: roleRows.map((r) => r.name) });
  }
  return withRoles;
}

export async function assignRole(
  db: Queryable,
  tenantId: string | undefined,
  membershipId: string,
  roleId: string,
): Promise<void> {
  requireTenantId(tenantId);
  await db.query(
    "insert into membership_roles (membership_id, role_id) values ($1, $2) on conflict do nothing",
    [membershipId, roleId],
  );
}

export async function revokeRole(
  db: Queryable,
  tenantId: string | undefined,
  membershipId: string,
  roleId: string,
): Promise<void> {
  requireTenantId(tenantId);
  await db.query("delete from membership_roles where membership_id = $1 and role_id = $2", [
    membershipId,
    roleId,
  ]);
}
