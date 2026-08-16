export interface Tenant {
  id: string;
  name: string;
  slug: string;
  policy_version: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface Role {
  id: string;
  tenant_id: string | null;
  name: string;
  is_system: boolean;
  created_at: string;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  created_at: string;
}

export interface ServiceClient {
  id: string;
  tenant_id: string;
  client_id: string;
  secret_hash: string;
  name: string;
  created_at: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  tenant_id: string;
  family_id: string;
  token_hash: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  subject: string;
  action: string;
  resource: string;
  decision: "allow" | "deny";
  path: "local" | "central";
  created_at: string;
}

export interface MembershipContext {
  tenant: Tenant;
  membership: Membership;
  roles: string[];
  permissions: string[];
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
}

export interface Document {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  status: string;
  created_at: string;
}
