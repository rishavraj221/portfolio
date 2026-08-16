import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, verifyServiceToken } from "../auth/tokens.js";
import { checkTokenFreshness } from "../auth/policyVersion.js";

declare module "fastify" {
  interface FastifyRequest {
    userAuth?: {
      userId: string;
      tenantId: string;
      roles: string[];
      permissions: string[];
      policyVersion: number;
      stale: boolean;
      currentPolicyVersion: number;
    };
    serviceAuth?: {
      clientId: string;
      tenantId: string;
      scopes: string[];
    };
  }
}

function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

// Local check: signature verified against the cached JWKS key, no network
// call, no dependency on this service being up beyond having the key. The
// only extra step is comparing the token's policy version against the
// cached tenant version so a role change is visible on the next request.
export async function requireUserAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    reply.code(401).send({ error: "missing bearer token" });
    return reply;
  }
  try {
    const claims = await verifyAccessToken(token);
    const { stale, currentVersion } = await checkTokenFreshness(claims.tenant_id, claims.pv);
    req.userAuth = {
      userId: claims.sub as string,
      tenantId: claims.tenant_id,
      roles: claims.roles,
      permissions: claims.permissions,
      policyVersion: claims.pv,
      stale,
      currentPolicyVersion: currentVersion,
    };
  } catch {
    reply.code(401).send({ error: "invalid or expired token" });
    return reply;
  }
}

export async function requireServiceAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    reply.code(401).send({ error: "missing bearer token" });
    return reply;
  }
  try {
    const claims = await verifyServiceToken(token);
    req.serviceAuth = { clientId: claims.client_id, tenantId: claims.tenant_id, scopes: claims.scopes };
  } catch {
    reply.code(401).send({ error: "invalid or expired service token" });
    return reply;
  }
}

export function requirePermission(permission: string) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.userAuth?.permissions.includes(permission)) {
      reply.code(403).send({ error: `missing permission ${permission}` });
      return reply;
    }
  };
}
