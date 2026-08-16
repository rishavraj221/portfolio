import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type AuditEntry } from "../lib/api";

// Fetched from the server's audit_log table -- this is what actually
// persists. It only ever contains central-path decisions, which is the
// point the writeup makes: a local check leaves no trace with us.
export function AuditLogPanel() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    const load = () => api.auditLog(accessToken).then((r) => setEntries(r.entries));
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [accessToken]);

  return (
    <div className="panel">
      <h2>Server audit log</h2>
      <p className="hint">Persisted rows in audit_log -- central decisions only, this tenant.</p>
      <ul className="log-list">
        {entries.map((e) => (
          <li key={e.id} className={`log-entry decision-${e.decision}`}>
            <span className="log-action">{e.action}</span>
            <span className="log-resource">{e.resource}</span>
            <span className={`log-decision decision-${e.decision}`}>{e.decision}</span>
            <span className="log-reason">{new Date(e.created_at).toLocaleTimeString()}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="hint">No central decisions logged yet.</li>}
      </ul>
    </div>
  );
}
