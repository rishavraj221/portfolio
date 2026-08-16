import { pool } from "../src/lib/db.js";
import { hashPassword } from "../src/lib/password.js";
import { createTenant } from "../src/repo/tenants.js";
import { createUser } from "../src/repo/users.js";
import { createMembership } from "../src/repo/memberships.js";
import { createPermission } from "../src/repo/permissions.js";
import { createRole, setRolePermissions } from "../src/repo/roles.js";
import { createProject, createDocument, addProjectMember } from "../src/repo/projects.js";
import { createServiceClient, setServiceClientScopes } from "../src/repo/serviceClients.js";

const DEMO_PASSWORD = "password123";

const PERMISSIONS = [
  ["admin:manage", "Manage tenant roles, memberships and service clients"],
  ["project:read", "View projects"],
  ["project:write", "Create and edit projects"],
  ["document:read", "View documents"],
  ["document:write", "Create and edit documents"],
  ["document:approve", "Approve a document (resource-level: only within your projects)"],
  ["billing:read", "Open the billing page"],
] as const;

async function main() {
  const existing = await pool.query("select 1 from tenants where slug = 'acme'");
  if (existing.rows.length > 0) {
    console.log("demo tenant 'acme' already seeded, skipping");
    await pool.end();
    return;
  }

  console.log("seeding demo data...");

  const permissions = new Map<string, string>();
  for (const [key, description] of PERMISSIONS) {
    const p = await createPermission(pool, key, description);
    permissions.set(key, p.id);
  }
  const ids = (keys: string[]) => keys.map((k) => permissions.get(k)!);

  const tenant = await createTenant(pool, "Acme Inc", "acme");
  console.log(`tenant: ${tenant.name} (${tenant.slug}, id=${tenant.id})`);

  const adminRole = await createRole(pool, tenant.id, "Admin");
  await setRolePermissions(pool, adminRole.id, ids(PERMISSIONS.map((p) => p[0])));

  const approverRole = await createRole(pool, tenant.id, "Approver");
  await setRolePermissions(
    pool,
    approverRole.id,
    ids(["project:read", "document:read", "document:write", "document:approve"]),
  );

  const viewerRole = await createRole(pool, tenant.id, "Viewer");
  await setRolePermissions(pool, viewerRole.id, ids(["project:read", "document:read", "billing:read"]));

  const projectAlpha = await createProject(pool, tenant.id, "Project Alpha");
  const projectBeta = await createProject(pool, tenant.id, "Project Beta");

  const users: { email: string; roleId: string; projectId?: string }[] = [
    { email: "admin@acme.test", roleId: adminRole.id },
    { email: "alice@acme.test", roleId: approverRole.id, projectId: projectAlpha.id },
    { email: "bob@acme.test", roleId: approverRole.id, projectId: projectBeta.id },
    { email: "carol@acme.test", roleId: viewerRole.id },
  ];

  for (const u of users) {
    const user = await createUser(pool, u.email, await hashPassword(DEMO_PASSWORD));
    const membership = await createMembership(pool, tenant.id, user.id);
    await pool.query("insert into membership_roles (membership_id, role_id) values ($1, $2)", [
      membership.id,
      u.roleId,
    ]);
    if (u.projectId) {
      await addProjectMember(pool, u.projectId, membership.id);
    }
    console.log(`user: ${u.email} / ${DEMO_PASSWORD}`);
  }

  await createDocument(pool, tenant.id, projectAlpha.id, "Alpha Q3 Report");
  await createDocument(pool, tenant.id, projectBeta.id, "Beta Roadmap");

  const serviceClientId = "client_demo_billing";
  const serviceClientSecret = "demo-service-secret";
  const serviceClient = await createServiceClient(
    pool,
    tenant.id,
    serviceClientId,
    await hashPassword(serviceClientSecret),
    "Billing integration",
  );
  await setServiceClientScopes(pool, serviceClient.id, ids(["project:read", "document:read"]));
  console.log(`service client: ${serviceClientId} / ${serviceClientSecret}`);

  console.log("\ndemo data ready. try:");
  console.log(`  alice@acme.test can approve "Alpha Q3 Report" but not "Beta Roadmap"`);
  console.log(`  bob@acme.test can approve "Beta Roadmap" but not "Alpha Q3 Report"`);
  console.log(`  both have the document:approve permission -- the difference is resource-level`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
