import type { Queryable } from "../lib/db.js";
import type { RefreshToken } from "../types.js";

export async function insertRefreshToken(
  db: Queryable,
  params: {
    userId: string;
    tenantId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  },
): Promise<RefreshToken> {
  const { rows } = await db.query<RefreshToken>(
    `insert into refresh_tokens (user_id, tenant_id, family_id, token_hash, expires_at)
     values ($1, $2, $3, $4, $5) returning *`,
    [params.userId, params.tenantId, params.familyId, params.tokenHash, params.expiresAt],
  );
  const token = rows[0];
  if (!token) throw new Error("failed to insert refresh token");
  return token;
}

export async function getRefreshTokenByHash(
  db: Queryable,
  tokenHash: string,
): Promise<RefreshToken | null> {
  const { rows } = await db.query<RefreshToken>("select * from refresh_tokens where token_hash = $1", [
    tokenHash,
  ]);
  return rows[0] ?? null;
}

export async function markRefreshTokenUsed(db: Queryable, id: string): Promise<void> {
  await db.query("update refresh_tokens set used_at = now() where id = $1", [id]);
}

// A reused (already-used) refresh token means the family may be stolen --
// revoke everything in it so the legitimate holder is forced to re-login.
export async function revokeRefreshTokenFamily(db: Queryable, familyId: string): Promise<void> {
  await db.query(
    "update refresh_tokens set revoked_at = now() where family_id = $1 and revoked_at is null",
    [familyId],
  );
}
