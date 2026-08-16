import type { Queryable } from "../lib/db.js";
import type { Document, Project } from "../types.js";
import { requireTenantId } from "./tenantScoped.js";

export async function createProject(
  db: Queryable,
  tenantId: string | undefined,
  name: string,
): Promise<Project> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Project>(
    "insert into projects (tenant_id, name) values ($1, $2) returning *",
    [tid, name],
  );
  const project = rows[0];
  if (!project) throw new Error("failed to create project");
  return project;
}

export async function listProjectsForTenant(db: Queryable, tenantId: string | undefined): Promise<Project[]> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Project>("select * from projects where tenant_id = $1 order by created_at asc", [
    tid,
  ]);
  return rows;
}

export async function addProjectMember(db: Queryable, projectId: string, membershipId: string): Promise<void> {
  await db.query(
    "insert into project_members (project_id, membership_id) values ($1, $2) on conflict do nothing",
    [projectId, membershipId],
  );
}

export async function isProjectMember(db: Queryable, projectId: string, membershipId: string): Promise<boolean> {
  const { rows } = await db.query(
    "select 1 from project_members where project_id = $1 and membership_id = $2",
    [projectId, membershipId],
  );
  return rows.length > 0;
}

export async function createDocument(
  db: Queryable,
  tenantId: string | undefined,
  projectId: string,
  title: string,
): Promise<Document> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Document>(
    "insert into documents (tenant_id, project_id, title) values ($1, $2, $3) returning *",
    [tid, projectId, title],
  );
  const document = rows[0];
  if (!document) throw new Error("failed to create document");
  return document;
}

export async function listDocumentsForTenant(db: Queryable, tenantId: string | undefined): Promise<Document[]> {
  const tid = requireTenantId(tenantId);
  const { rows } = await db.query<Document>(
    "select * from documents where tenant_id = $1 order by created_at asc",
    [tid],
  );
  return rows;
}

export async function getDocumentById(db: Queryable, documentId: string): Promise<Document | null> {
  const { rows } = await db.query<Document>("select * from documents where id = $1", [documentId]);
  return rows[0] ?? null;
}
