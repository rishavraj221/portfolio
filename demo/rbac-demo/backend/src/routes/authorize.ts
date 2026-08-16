import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/authorize.js";
import { requireUserAuth } from "../plugins/authenticate.js";
import { pool } from "../lib/db.js";
import { listAuditLogForTenant } from "../repo/auditLog.js";

const authorizeSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
});

export async function authorizeRoutes(app: FastifyInstance) {
  // The central path from the writeup: subject, action, resource in, a
  // decision out, and unlike a local token check this always leaves a
  // record -- that's the whole reason resource-level questions can't just
  // be stuffed into the token.
  app.post("/v1/authorize", { preHandler: requireUserAuth }, async (req) => {
    const body = authorizeSchema.parse(req.body);
    const auth = req.userAuth!;
    const result = await authorize({
      tenantId: auth.tenantId,
      subjectUserId: auth.userId,
      action: body.action,
      resource: body.resource,
    });
    return { ...result, path: "central" as const };
  });

  app.get("/v1/audit-log", { preHandler: requireUserAuth }, async (req) => {
    const auth = req.userAuth!;
    const entries = await listAuditLogForTenant(pool, auth.tenantId, 100);
    return { entries };
  });
}
