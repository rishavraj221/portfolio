import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool, withTransaction } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { requirePermission, requireUserAuth } from "../plugins/authenticate.js";
import {
  assignRole,
  createMembership,
  getMembership,
  listMembershipContextsForUser,
  listMembershipsWithEmailForTenant,
  revokeRole,
} from "../repo/memberships.js";
import { createPermission, getPermissionsByKeys, listPermissions } from "../repo/permissions.js";
import { createRole, listRolesForTenant, listPermissionsForRole, setRolePermissions } from "../repo/roles.js";
import { createServiceClient, setServiceClientScopes } from "../repo/serviceClients.js";
import { bumpPolicyVersion, createTenant, getTenantById, listTenants } from "../repo/tenants.js";
import { createUser, getUserByEmail } from "../repo/users.js";
import { invalidatePolicyVersionCache } from "../auth/policyVersion.js";
import { randomUUID } from "node:crypto";

const ADMIN_PERMISSION = "admin:manage";

export async function adminRoutes(app: FastifyInstance) {
  const requireAdmin = [requireUserAuth, requirePermission(ADMIN_PERMISSION)];

  // Bootstrap-only: creating a tenant has no tenant context yet, so it's
  // gated by nothing here. In production this would sit behind a superadmin
  // console outside the tenant-scoped API entirely.
  app.post("/v1/admin/tenants", async (req) => {
    const body = z.object({ name: z.string().min(1), slug: z.string().min(1) }).parse(req.body);
    return createTenant(pool, body.name, body.slug);
  });

  app.get("/v1/admin/tenants", async () => {
    return { tenants: await listTenants(pool) };
  });

  app.get("/v1/admin/permissions", async () => {
    return { permissions: await listPermissions(pool) };
  });

  app.post("/v1/admin/permissions", { preHandler: requireAdmin }, async (req) => {
    const body = z.object({ key: z.string().min(1), description: z.string().optional() }).parse(req.body);
    return createPermission(pool, body.key, body.description);
  });

  app.get("/v1/admin/roles", { preHandler: requireUserAuth }, async (req) => {
    const auth = req.userAuth!;
    const roles = await listRolesForTenant(pool, auth.tenantId);
    const withPermissions = await Promise.all(
      roles.map(async (role) => ({ ...role, permissions: await listPermissionsForRole(pool, role.id) })),
    );
    return { roles: withPermissions };
  });

  app.post("/v1/admin/roles", { preHandler: requireAdmin }, async (req) => {
    const auth = req.userAuth!;
    const body = z
      .object({ name: z.string().min(1), permissionKeys: z.array(z.string()).default([]) })
      .parse(req.body);
    const role = await createRole(pool, auth.tenantId, body.name);
    const permissions = await getPermissionsByKeys(pool, body.permissionKeys);
    await setRolePermissions(pool, role.id, permissions.map((p) => p.id));
    return { ...role, permissions: permissions.map((p) => p.key) };
  });

  app.put("/v1/admin/roles/:roleId/permissions", { preHandler: requireAdmin }, async (req) => {
    const params = z.object({ roleId: z.string().uuid() }).parse(req.params);
    const body = z.object({ permissionKeys: z.array(z.string()) }).parse(req.body);
    const permissions = await getPermissionsByKeys(pool, body.permissionKeys);
    await setRolePermissions(pool, params.roleId, permissions.map((p) => p.id));
    return { roleId: params.roleId, permissions: permissions.map((p) => p.key) };
  });

  app.get("/v1/admin/memberships", { preHandler: requireUserAuth }, async (req) => {
    const auth = req.userAuth!;
    return { memberships: await listMembershipsWithEmailForTenant(pool, auth.tenantId) };
  });

  // Invites a user (creating the user record if this is their first tenant)
  // and creates the membership. Password is a demo placeholder --
  // production would send an invite link instead of minting a password.
  app.post("/v1/admin/memberships", { preHandler: requireAdmin }, async (req) => {
    const auth = req.userAuth!;
    const body = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(req.body);

    return withTransaction(async (client) => {
      let user = await getUserByEmail(client, body.email);
      if (!user) {
        user = await createUser(client, body.email, await hashPassword(body.password));
      }
      const existing = await getMembership(client, auth.tenantId, user.id);
      if (existing) return existing;
      return createMembership(client, auth.tenantId, user.id);
    });
  });

  // The one mutation that matters for revocation: assigning or revoking a
  // role bumps the tenant's policy version, and the cache is invalidated in
  // the same request so the next token-freshness check sees it immediately
  // rather than waiting for a TTL to expire.
  app.post("/v1/admin/memberships/:membershipId/roles", { preHandler: requireAdmin }, async (req) => {
    const auth = req.userAuth!;
    const params = z.object({ membershipId: z.string().uuid() }).parse(req.params);
    const body = z.object({ roleId: z.string().uuid() }).parse(req.body);
    await assignRole(pool, auth.tenantId, params.membershipId, body.roleId);
    const newVersion = await bumpPolicyVersion(pool, auth.tenantId);
    await invalidatePolicyVersionCache(auth.tenantId, newVersion);
    return { policyVersion: newVersion };
  });

  app.delete("/v1/admin/memberships/:membershipId/roles/:roleId", { preHandler: requireAdmin }, async (req) => {
    const auth = req.userAuth!;
    const params = z
      .object({ membershipId: z.string().uuid(), roleId: z.string().uuid() })
      .parse(req.params);
    await revokeRole(pool, auth.tenantId, params.membershipId, params.roleId);
    const newVersion = await bumpPolicyVersion(pool, auth.tenantId);
    await invalidatePolicyVersionCache(auth.tenantId, newVersion);
    return { policyVersion: newVersion };
  });

  app.get("/v1/admin/tenants/:tenantId", async (req, reply) => {
    const params = z.object({ tenantId: z.string() }).parse(req.params);
    const tenant = await getTenantById(pool, params.tenantId);
    if (!tenant) return reply.code(404).send({ error: "not found" });
    return tenant;
  });

  app.get("/v1/admin/memberships/user-contexts", { preHandler: requireUserAuth }, async (req) => {
    const auth = req.userAuth!;
    return { contexts: await listMembershipContextsForUser(pool, auth.userId) };
  });

  app.post("/v1/admin/service-clients", { preHandler: requireAdmin }, async (req) => {
    const auth = req.userAuth!;
    const body = z
      .object({ name: z.string().min(1), permissionKeys: z.array(z.string()).default([]) })
      .parse(req.body);
    const clientId = `client_${randomUUID().slice(0, 8)}`;
    const clientSecret = randomUUID();
    const client = await createServiceClient(
      pool,
      auth.tenantId,
      clientId,
      await hashPassword(clientSecret),
      body.name,
    );
    const permissions = await getPermissionsByKeys(pool, body.permissionKeys);
    await setServiceClientScopes(pool, client.id, permissions.map((p) => p.id));
    // clientSecret is only ever returned here, at creation time
    return { clientId, clientSecret, name: client.name, scopes: permissions.map((p) => p.key) };
  });
}
