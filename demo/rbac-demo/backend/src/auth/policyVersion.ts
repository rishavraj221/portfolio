import { pool } from "../lib/db.js";
import { getCachedPolicyVersion, setCachedPolicyVersion } from "../lib/redis.js";
import { getTenantById } from "../repo/tenants.js";

// Services keep a small cached map of tenant_id -> policy_version (Redis
// here) rather than hitting Postgres on every request. A cache miss falls
// back to the database and repopulates the cache.
export async function getCurrentPolicyVersion(tenantId: string): Promise<number> {
  const cached = await getCachedPolicyVersion(tenantId);
  if (cached !== null) return cached;

  const tenant = await getTenantById(pool, tenantId);
  if (!tenant) throw new Error(`tenant ${tenantId} not found`);
  await setCachedPolicyVersion(tenantId, tenant.policy_version);
  return tenant.policy_version;
}

export interface StaleTokenCheck {
  stale: boolean;
  currentVersion: number;
}

// A token minted under an older policy version is "stale": the caller has
// permissions on paper that may no longer be true. The caller decides what
// to do about it (force refresh, or fall back to a central check).
export async function checkTokenFreshness(tenantId: string, tokenPolicyVersion: number): Promise<StaleTokenCheck> {
  const currentVersion = await getCurrentPolicyVersion(tenantId);
  return { stale: tokenPolicyVersion < currentVersion, currentVersion };
}

export async function invalidatePolicyVersionCache(tenantId: string, newVersion: number): Promise<void> {
  await setCachedPolicyVersion(tenantId, newVersion);
}
