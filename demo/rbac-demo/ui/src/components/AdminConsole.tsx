import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDecisionLog } from "../context/DecisionLog";
import { api, type Membership, type Role } from "../lib/api";

export function AdminConsole() {
  const { accessToken, hasPermission } = useAuth();
  const { log } = useDecisionLog();
  const canManage = hasPermission("admin:manage");
  const [roles, setRoles] = useState<Role[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [lastBump, setLastBump] = useState<number | null>(null);

  useEffect(() => {
    log({
      path: "local",
      action: "admin:manage",
      resource: "(from token, no request)",
      decision: canManage ? "allow" : "deny",
      reason: canManage ? "permission present in cached token" : "permission absent from cached token",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [r, m] = await Promise.all([api.roles(accessToken), api.memberships(accessToken)]);
    setRoles(r.roles);
    setMemberships(m.memberships);
  }, [accessToken]);

  useEffect(() => {
    if (canManage) load().catch((err) => setError(err.message));
  }, [canManage, load]);

  if (!canManage) {
    return (
      <div className="panel">
        <h2>Admin console</h2>
        <p className="hint">Your role doesn't grant admin:manage -- decided locally, no request made.</p>
      </div>
    );
  }

  const toggleRole = async (membership: Membership, role: Role, hasRole: boolean) => {
    if (!accessToken) return;
    setError(null);
    try {
      const result = hasRole
        ? await api.revokeRole(accessToken, membership.id, role.id)
        : await api.assignRole(accessToken, membership.id, role.id);
      setLastBump(result.policyVersion);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !inviteEmail) return;
    await api.inviteMember(accessToken, inviteEmail, "password123");
    setInviteEmail("");
    await load();
  };

  return (
    <div className="panel">
      <h2>Admin console</h2>
      {error && <p className="error">{error}</p>}
      {lastBump !== null && (
        <p className="hint">
          Tenant policy_version bumped to {lastBump}. Every open session's badge will flip to "stale" on
          its next poll and refresh automatically.
        </p>
      )}

      <h3>Roles</h3>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="mono">{r.permissions.join(", ") || "(none)"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Memberships</h3>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Current roles</th>
            {roles.map((r) => (
              <th key={r.id}>{r.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {memberships.map((m) => (
            <tr key={m.id}>
              <td>{m.email}</td>
              <td className="mono">{m.roles.join(", ") || "(none)"}</td>
              {roles.map((r) => {
                const hasRole = m.roles.includes(r.name);
                return (
                  <td key={r.id}>
                    <button type="button" className={hasRole ? "toggle-on" : "toggle-off"} onClick={() => toggleRole(m, r, hasRole)}>
                      {hasRole ? "revoke" : "assign"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Invite member</h3>
      <form onSubmit={invite} className="form form-inline">
        <input
          placeholder="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <button type="submit">Invite (password: password123)</button>
      </form>
    </div>
  );
}
