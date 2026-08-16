// Every tenant-scoped repo function goes through this so a missing tenant_id
// is a thrown error at call time, not a silently unfiltered query.
export function requireTenantId(tenantId: string | undefined | null): string {
  if (!tenantId) {
    throw new Error("tenantId is required for this query");
  }
  return tenantId;
}
