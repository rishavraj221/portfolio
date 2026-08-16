-- Minimal resources to make the "resource level" half of the authorize
-- split demonstrable: a document belongs to a project, and project
-- membership is a fact that can't fit into a token without making every
-- token enormous and stale within minutes, per the writeup.

create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index projects_tenant_idx on projects(tenant_id);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  membership_id uuid not null references memberships(id) on delete cascade,
  primary key (project_id, membership_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
create index documents_tenant_idx on documents(tenant_id);
create index documents_project_idx on documents(project_id);
