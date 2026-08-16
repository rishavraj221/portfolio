import { randomUUID } from "node:crypto";
import { pool } from "../lib/db.js";
import { env } from "../lib/env.js";
import { verifyPassword } from "../lib/password.js";
import { getMembership, listMembershipContextsForUser } from "../repo/memberships.js";
import {
  getRefreshTokenByHash,
  insertRefreshToken,
  markRefreshTokenUsed,
  revokeRefreshTokenFamily,
} from "../repo/refreshTokens.js";
import { getUserByEmail } from "../repo/users.js";
import { generateOpaqueToken, hashOpaqueToken, signAccessToken } from "./tokens.js";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode = 401,
  ) {
    super(message);
  }
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
}

async function issueTokenPair(userId: string, tenantId: string, familyId?: string): Promise<TokenPair> {
  const contexts = await listMembershipContextsForUser(pool, userId);
  const context = contexts.find((c) => c.tenant.id === tenantId);
  if (!context) throw new AuthError("user has no membership in this tenant", 403);

  const accessToken = await signAccessToken({
    userId,
    tenantId,
    roles: context.roles,
    permissions: context.permissions,
    policyVersion: context.tenant.policy_version,
  });

  const refreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlSeconds * 1000);
  await insertRefreshToken(pool, {
    userId,
    tenantId,
    familyId: familyId ?? randomUUID(),
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken, tenantId };
}

export async function login(email: string, password: string, tenantId: string): Promise<TokenPair> {
  const user = await getUserByEmail(pool, email);
  if (!user) throw new AuthError("invalid credentials");

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) throw new AuthError("invalid credentials");

  const membership = await getMembership(pool, tenantId, user.id);
  if (!membership) throw new AuthError("user has no membership in this tenant", 403);

  return issueTokenPair(user.id, tenantId);
}

// Rotation with reuse detection: every refresh consumes the token and mints
// a new one in the same family. If a token that was already used shows up
// again, the whole family is revoked -- that's the signal a refresh token
// was stolen and used by someone other than its legitimate holder.
export async function refresh(refreshToken: string): Promise<TokenPair> {
  const tokenHash = hashOpaqueToken(refreshToken);
  const stored = await getRefreshTokenByHash(pool, tokenHash);
  if (!stored) throw new AuthError("invalid refresh token");

  if (stored.revoked_at) throw new AuthError("refresh token revoked, please log in again");

  if (stored.used_at) {
    await revokeRefreshTokenFamily(pool, stored.family_id);
    throw new AuthError("refresh token reuse detected, session revoked");
  }

  if (new Date(stored.expires_at) < new Date()) {
    throw new AuthError("refresh token expired, please log in again");
  }

  await markRefreshTokenUsed(pool, stored.id);
  return issueTokenPair(stored.user_id, stored.tenant_id, stored.family_id);
}
