import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDecisionLog } from "../context/DecisionLog";
import { api, type Document, type Project } from "../lib/api";

export function ProtectedApp() {
  const { accessToken, hasPermission } = useAuth();
  const { log } = useDecisionLog();
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canReadDocuments = hasPermission("document:read");
  const canApprove = hasPermission("document:approve");

  // Logged once when the checked permissions change (e.g. after login), not
  // on every render -- the check itself stays a pure read during render.
  useEffect(() => {
    for (const permission of ["document:read", "document:approve"]) {
      const allowed = hasPermission(permission);
      log({
        path: "local",
        action: permission,
        resource: "(from token, no request)",
        decision: allowed ? "allow" : "deny",
        reason: allowed ? "permission present in cached token" : "permission absent from cached token",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadDocuments, canApprove]);

  useEffect(() => {
    if (!accessToken || !canReadDocuments) return;
    Promise.all([api.projects(accessToken), api.documents(accessToken)])
      .then(([p, d]) => {
        setProjects(p.projects);
        setDocuments(d.documents);
      })
      .catch((err) => setError(err.message));
  }, [accessToken, canReadDocuments]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id;

  const approve = async (doc: Document) => {
    if (!accessToken) return;
    const result = await api.approveDocument(accessToken, doc.id);
    log({
      path: "central",
      action: "document:approve",
      resource: `document:${doc.id} (${doc.title})`,
      decision: result.decision,
      reason: result.reason,
    });
    if (result.decision === "allow") {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "approved" } : d)));
    }
  };

  if (!canReadDocuments) {
    return (
      <div className="panel">
        <h2>Protected app</h2>
        <p className="hint">Your role doesn't grant document:read -- this was decided locally, no request made.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Protected app -- documents</h2>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Project</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.title}</td>
              <td>{projectName(doc.project_id)}</td>
              <td>{doc.status}</td>
              <td>
                {doc.status === "approved" ? (
                  <span className="hint">approved</span>
                ) : canApprove ? (
                  <button type="button" onClick={() => approve(doc)}>
                    Approve
                  </button>
                ) : (
                  <span className="hint" title="document:approve missing from cached token">
                    no approve permission
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Approve is always a central check: whether it succeeds depends on project membership, which
        can't live in the token. The button being visible at all was a local check on{" "}
        <code>document:approve</code>.
      </p>
    </div>
  );
}
