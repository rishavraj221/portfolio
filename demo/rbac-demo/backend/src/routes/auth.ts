import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthError, login, refresh } from "../auth/service.js";
import { issueServiceToken } from "../auth/clientCredentials.js";
import { getJwks } from "../auth/keys.js";
import { resolveTenantIdentifier } from "../repo/tenantLookup.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlugOrId: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const clientCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.get("/.well-known/jwks.json", async () => getJwks());

  app.post("/v1/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    try {
      const tenantId = await resolveTenantIdentifier(body.tenantSlugOrId);
      if (!tenantId) return reply.code(404).send({ error: "tenant not found" });

      const result = await login(body.email, body.password, tenantId);
      return result;
    } catch (err) {
      if (err instanceof AuthError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/v1/auth/refresh", async (req, reply) => {
    const body = refreshSchema.parse(req.body);
    try {
      return await refresh(body.refreshToken);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/v1/auth/token", async (req, reply) => {
    const body = clientCredentialsSchema.parse(req.body);
    try {
      const accessToken = await issueServiceToken(body.clientId, body.clientSecret);
      return { accessToken };
    } catch (err) {
      if (err instanceof AuthError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
