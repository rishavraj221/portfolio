const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      // Fastify's JSON parser rejects an empty body when this header is
      // set at all, so only send it when there's actually a body to parse.
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? res.statusText, res.status);
  return body as T;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
}

export const api = {
  login: (email: string, password: string, tenantSlugOrId: string) =>
    request<TokenPair>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, tenantSlugOrId }),
    }),

  refresh: (refreshToken: string) =>
    request<TokenPair>("/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),

  me: (token: string) =>
    request<{
      userId: string;
      tenantId: string;
      roles: string[];
      permissions: string[];
      tokenPolicyVersion: number;
      currentPolicyVersion: number;
      stale: boolean;
    }>("/v1/me", {}, token),

  authorize: (token: string, action: string, resource: string) =>
    request<{ decision: "allow" | "deny"; reason: string; path: "central" }>(
      "/v1/authorize",
      { method: "POST", body: JSON.stringify({ action, resource }) },
      token,
    ),

  auditLog: (token: string) =>
    request<{ entries: AuditEntry[] }>("/v1/audit-log", {}, token),

  projects: (token: string) => request<{ projects: Project[] }>("/v1/demo/projects", {}, token),

  documents: (token: string) => request<{ documents: Document[] }>("/v1/demo/documents", {}, token),

  approveDocument: (token: string, documentId: string) =>
    request<{ decision: "allow" | "deny"; reason: string; path: "central" }>(
      `/v1/demo/documents/${documentId}/approve`,
      { method: "POST" },
      token,
    ).catch((err) => {
      if (err instanceof ApiError && err.status === 403) {
        return err as unknown as { decision: "deny"; reason: string; path: "central" };
      }
      throw err;
    }),

  roles: (token: string) => request<{ roles: Role[] }>("/v1/admin/roles", {}, token),

  memberships: (token: string) =>
    request<{ memberships: Membership[] }>("/v1/admin/memberships", {}, token),

  inviteMember: (token: string, email: string, password: string) =>
    request<unknown>(
      "/v1/admin/memberships",
      { method: "POST", body: JSON.stringify({ email, password }) },
      token,
    ),

  assignRole: (token: string, membershipId: string, roleId: string) =>
    request<{ policyVersion: number }>(
      `/v1/admin/memberships/${membershipId}/roles`,
      { method: "POST", body: JSON.stringify({ roleId }) },
      token,
    ),

  revokeRole: (token: string, membershipId: string, roleId: string) =>
    request<{ policyVersion: number }>(
      `/v1/admin/memberships/${membershipId}/roles/${roleId}`,
      { method: "DELETE" },
      token,
    ),
};

export interface Project {
  id: string;
  name: string;
}

export interface Document {
  id: string;
  project_id: string;
  title: string;
  status: string;
}

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissions: string[];
}

export interface Membership {
  id: string;
  user_id: string;
  tenant_id: string;
  email: string;
  roles: string[];
}

export interface AuditEntry {
  id: string;
  subject: string;
  action: string;
  resource: string;
  decision: "allow" | "deny";
  path: "local" | "central";
  created_at: string;
}
