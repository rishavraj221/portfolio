import { pool } from "../lib/db.js";
import { writeAuditEntry } from "../repo/auditLog.js";
import { getDocumentById, isProjectMember } from "../repo/projects.js";
import { getMembership, listMembershipContextsForUser } from "../repo/memberships.js";

export interface AuthorizeRequest {
  tenantId: string;
  subjectUserId: string;
  action: string; // "document:approve"
  resource: string; // "document:<uuid>"
}

export interface AuthorizeResult {
  decision: "allow" | "deny";
  reason: string;
}

// The central decision. Two gates: does the subject's role grant this
// permission at all (coarse, same check a token could answer), and does the
// resource itself belong to something the subject has access to (fine,
// cannot be answered from a token alone). Every call here is logged --
// that's the point of the central path versus the local one.
export async function authorize(req: AuthorizeRequest): Promise<AuthorizeResult> {
  const result = await decide(req);
  await writeAuditEntry(pool, {
    tenantId: req.tenantId,
    subject: req.subjectUserId,
    action: req.action,
    resource: req.resource,
    decision: result.decision,
    path: "central",
  });
  return result;
}

async function decide(req: AuthorizeRequest): Promise<AuthorizeResult> {
  const membership = await getMembership(pool, req.tenantId, req.subjectUserId);
  if (!membership) {
    return { decision: "deny", reason: "subject has no membership in this tenant" };
  }

  const contexts = await listMembershipContextsForUser(pool, req.subjectUserId);
  const context = contexts.find((c) => c.tenant.id === req.tenantId);
  if (!context || !context.permissions.includes(req.action)) {
    return { decision: "deny", reason: `role does not grant permission ${req.action}` };
  }

  const [resourceType, resourceId] = req.resource.split(":");
  if (resourceType === "document" && resourceId) {
    const document = await getDocumentById(pool, resourceId);
    if (!document || document.tenant_id !== req.tenantId) {
      return { decision: "deny", reason: "document not found in this tenant" };
    }
    const member = await isProjectMember(pool, document.project_id, membership.id);
    if (!member) {
      return { decision: "deny", reason: "subject is not a member of the document's project" };
    }
  }

  return { decision: "allow", reason: "permission granted and resource check passed" };
}
