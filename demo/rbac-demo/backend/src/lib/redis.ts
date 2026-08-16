import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.redisUrl, { lazyConnect: false });

const POLICY_VERSION_PREFIX = "policy_version:";

// Cached map of tenant_id -> policy_version, refreshed on write and read
// through here so services never hit Postgres just to check staleness.
export async function getCachedPolicyVersion(tenantId: string): Promise<number | null> {
  const raw = await redis.get(POLICY_VERSION_PREFIX + tenantId);
  return raw === null ? null : Number(raw);
}

export async function setCachedPolicyVersion(tenantId: string, version: number): Promise<void> {
  await redis.set(POLICY_VERSION_PREFIX + tenantId, String(version));
}
