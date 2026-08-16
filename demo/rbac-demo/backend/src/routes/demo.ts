import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../lib/db.js";
import { requirePermission, requireUserAuth } from "../plugins/authenticate.js";
import { addProjectMember, createDocument, createProject, listDocumentsForTenant, listProjectsForTenant } from "../repo/projects.js";
import { authorize } from "../auth/authorize.js";

// This is the "protected app" the demo UI drives. Reading the project/document
// lists is a coarse, role-level check (answerable from the token, so the UI
// gates the buttons for these locally too). Approving a specific document is
// resource-level and always goes through the central authorize() call below,
// which is what actually gets logged to the audit trail.
export async function demoRoutes(app: FastifyInstance) {
  app.get(
    "/v1/demo/projects",
    { preHandler: [requireUserAuth, requirePermission("project:read")] },
    async (req) => {
      const auth = req.userAuth!;
      return { projects: await listProjectsForTenant(pool, auth.tenantId) };
    },
  );

  app.post(
    "/v1/demo/projects",
    { preHandler: [requireUserAuth, requirePermission("project:write")] },
    async (req) => {
      const auth = req.userAuth!;
      const body = z.object({ name: z.string().min(1) }).parse(req.body);
      return createProject(pool, auth.tenantId, body.name);
    },
  );

  app.post(
    "/v1/demo/projects/:projectId/members/:membershipId",
    { preHandler: [requireUserAuth, requirePermission("project:write")] },
    async (req) => {
      const params = z.object({ projectId: z.string().uuid(), membershipId: z.string().uuid() }).parse(
        req.params,
      );
      await addProjectMember(pool, params.projectId, params.membershipId);
      return { ok: true };
    },
  );

  app.get(
    "/v1/demo/documents",
    { preHandler: [requireUserAuth, requirePermission("document:read")] },
    async (req) => {
      const auth = req.userAuth!;
      return { documents: await listDocumentsForTenant(pool, auth.tenantId) };
    },
  );

  app.post(
    "/v1/demo/documents",
    { preHandler: [requireUserAuth, requirePermission("document:write")] },
    async (req) => {
      const auth = req.userAuth!;
      const body = z.object({ projectId: z.string().uuid(), title: z.string().min(1) }).parse(req.body);
      return createDocument(pool, auth.tenantId, body.projectId, body.title);
    },
  );

  // Resource-level: whether this document can be approved depends on
  // project membership, which cannot live in the token. Always central.
  app.post("/v1/demo/documents/:documentId/approve", { preHandler: requireUserAuth }, async (req, reply) => {
    const auth = req.userAuth!;
    const params = z.object({ documentId: z.string().uuid() }).parse(req.params);

    const result = await authorize({
      tenantId: auth.tenantId,
      subjectUserId: auth.userId,
      action: "document:approve",
      resource: `document:${params.documentId}`,
    });

    if (result.decision === "deny") {
      return reply.code(403).send({ ...result, path: "central" });
    }

    await pool.query("update documents set status = 'approved' where id = $1", [params.documentId]);
    return { ...result, path: "central" as const };
  });
}
