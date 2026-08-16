import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../src/lib/db.js";
import { createTenant } from "../src/repo/tenants.js";
import { createUser } from "../src/repo/users.js";
import { createMembership, listMembershipsForTenant } from "../src/repo/memberships.js";
import { createRole } from "../src/repo/roles.js";
import { hashPassword } from "../src/lib/password.js";

// Every case here seeds two tenants and asserts a query scoped to one never
// returns anything belonging to the other -- this is the test strategy the
// writeup credits with catching more than the "throw without tenant_id" rule did.

test("memberships scoped to one tenant never include another tenant's members", async () => {
  const tenantA = await createTenant(pool, "Tenant A", `tenant-a-${Date.now()}`);
  const tenantB = await createTenant(pool, "Tenant B", `tenant-b-${Date.now()}`);

  const userA = await createUser(pool, `a-${Date.now()}@example.com`, await hashPassword("pw"));
  const userB = await createUser(pool, `b-${Date.now()}@example.com`, await hashPassword("pw"));

  await createMembership(pool, tenantA.id, userA.id);
  await createMembership(pool, tenantB.id, userB.id);

  const membersOfA = await listMembershipsForTenant(pool, tenantA.id);
  assert.equal(membersOfA.length, 1);
  assert.equal(membersOfA[0]?.user_id, userA.id);
  assert.ok(!membersOfA.some((m) => m.user_id === userB.id));
});

test("roles created for one tenant are not listed for another tenant's custom roles", async () => {
  const tenantA = await createTenant(pool, "Tenant A", `tenant-a-${Date.now()}-2`);
  const tenantB = await createTenant(pool, "Tenant B", `tenant-b-${Date.now()}-2`);

  const roleA = await createRole(pool, tenantA.id, "billing-admin");

  const { listRolesForTenant } = await import("../src/repo/roles.js");
  const rolesForB = await listRolesForTenant(pool, tenantB.id);
  assert.ok(!rolesForB.some((r) => r.id === roleA.id));
});

test("repo functions throw rather than silently querying without a tenant id", async () => {
  await assert.rejects(() => createMembership(pool, undefined, "some-user-id"));
  await assert.rejects(() => listMembershipsForTenant(pool, ""));
});

test.after(async () => {
  await pool.end();
});
