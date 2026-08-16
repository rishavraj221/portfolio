import type { Queryable } from "../lib/db.js";
import type { AuditLogEntry } from "../types.js";

export async function writeAuditEntry(
  db: Queryable,
  entry: {
    tenantId: string | null;
    subject: string;
    action: string;
    resource: string;
    decision: "allow" | "deny";
    path: "local" | "central";
  },
): Promise<AuditLogEntry> {
  const { rows } = await db.query<AuditLogEntry>(
    `insert into audit_log (tenant_id, subject, action, resource, decision, path)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [entry.tenantId, entry.subject, entry.action, entry.resource, entry.decision, entry.path],
  );
  const row = rows[0];
  if (!row) throw new Error("failed to write audit entry");
  return row;
}

export async function listAuditLogForTenant(
  db: Queryable,
  tenantId: string,
  limit = 50,
): Promise<AuditLogEntry[]> {
  const { rows } = await db.query<AuditLogEntry>(
    "select * from audit_log where tenant_id = $1 order by created_at desc limit $2",
    [tenantId, limit],
  );
  return rows;
}
