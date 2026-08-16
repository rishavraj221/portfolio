import type { FastifyInstance } from "fastify";
import { requireUserAuth } from "../plugins/authenticate.js";

export async function meRoutes(app: FastifyInstance) {
  // Lets the UI show the "token version vs tenant version" badge live,
  // and tells it whether this specific request was answered on a stale token.
  app.get("/v1/me", { preHandler: requireUserAuth }, async (req) => {
    const auth = req.userAuth!;
    return {
      userId: auth.userId,
      tenantId: auth.tenantId,
      roles: auth.roles,
      permissions: auth.permissions,
      tokenPolicyVersion: auth.policyVersion,
      currentPolicyVersion: auth.currentPolicyVersion,
      stale: auth.stale,
    };
  });
}
