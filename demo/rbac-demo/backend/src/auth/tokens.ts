import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../lib/env.js";
import { getActiveSigningKey } from "./keys.js";

export interface AccessTokenClaims extends JWTPayload {
  tenant_id: string;
  roles: string[];
  permissions: string[];
  pv: number; // policy version this token was minted under
}

export interface ServiceTokenClaims extends JWTPayload {
  tenant_id: string;
  client_id: string;
  scopes: string[];
}

export async function signAccessToken(params: {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  policyVersion: number;
}): Promise<string> {
  const key = await getActiveSigningKey();
  return new SignJWT({
    tenant_id: params.tenantId,
    roles: params.roles,
    permissions: params.permissions,
    pv: params.policyVersion,
  })
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setSubject(params.userId)
    .setIssuer(env.issuer)
    .setAudience(env.userAudience)
    .setIssuedAt()
    .setExpirationTime(`${env.accessTokenTtlSeconds}s`)
    .sign(key.privateKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const key = await getActiveSigningKey();
  const { payload } = await jwtVerify(token, key.publicKey, {
    issuer: env.issuer,
    audience: env.userAudience,
  });
  return payload as AccessTokenClaims;
}

export async function signServiceToken(params: {
  clientId: string;
  tenantId: string;
  scopes: string[];
}): Promise<string> {
  const key = await getActiveSigningKey();
  return new SignJWT({
    tenant_id: params.tenantId,
    client_id: params.clientId,
    scopes: params.scopes,
  })
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setSubject(`service-client:${params.clientId}`)
    .setIssuer(env.issuer)
    // Separate audience so a service token can never be replayed against a
    // user-facing endpoint, even though it's signed by the same key.
    .setAudience(env.serviceAudience)
    .setIssuedAt()
    .setExpirationTime(`${env.serviceTokenTtlSeconds}s`)
    .sign(key.privateKey);
}

export async function verifyServiceToken(token: string): Promise<ServiceTokenClaims> {
  const key = await getActiveSigningKey();
  const { payload } = await jwtVerify(token, key.publicKey, {
    issuer: env.issuer,
    audience: env.serviceAudience,
  });
  return payload as ServiceTokenClaims;
}

// Refresh tokens are opaque (not JWTs) so they carry no information if
// leaked; only the sha256 hash is ever persisted.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
