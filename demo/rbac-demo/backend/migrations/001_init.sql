create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  policy_version integer not null default 1,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- "resource:action"
  description text
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade, -- null = system role
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint roles_tenant_name_unique unique (tenant_id, name)
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint memberships_tenant_user_unique unique (tenant_id, user_id)
);

create table membership_roles (
  membership_id uuid not null references memberships(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (membership_id, role_id)
);

create table service_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id text not null unique,
  secret_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table service_client_scopes (
  service_client_id uuid not null references service_clients(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (service_client_id, permission_id)
);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  family_id uuid not null,
  token_hash text not null unique,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index refresh_tokens_family_idx on refresh_tokens(family_id);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  subject text not null,
  action text not null,
  resource text not null,
  decision text not null check (decision in ('allow', 'deny')),
  path text not null check (path in ('local', 'central')),
  created_at timestamptz not null default now()
);
create index audit_log_tenant_idx on audit_log(tenant_id, created_at desc);

-- Documents the "the worst bug here is the silent one" rule from the writeup:
-- every tenant-scoped table gets an index on tenant_id since every repo query
-- filters on it as a required first argument.
create index memberships_tenant_idx on memberships(tenant_id);
create index roles_tenant_idx on roles(tenant_id);
create index service_clients_tenant_idx on service_clients(tenant_id);
