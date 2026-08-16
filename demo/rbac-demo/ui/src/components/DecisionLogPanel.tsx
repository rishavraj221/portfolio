import { useDecisionLog } from "../context/DecisionLog";

export function DecisionLogPanel() {
  const { entries, clear } = useDecisionLog();

  return (
    <div className="panel decision-log">
      <div className="decision-log-header">
        <h2>Decision log</h2>
        <button type="button" className="link" onClick={clear}>
          clear
        </button>
      </div>
      <p className="hint">
        <span className="tag tag-local">local</span> checks read straight from the cached token, no
        request made. <span className="tag tag-central">central</span> checks call{" "}
        <code>POST /v1/authorize</code> and are the only ones that leave a trace.
      </p>
      <ul className="log-list">
        {entries.map((e) => (
          <li key={e.id} className={`log-entry decision-${e.decision}`}>
            <span className={`tag tag-${e.path}`}>{e.path}</span>
            <span className="log-action">{e.action}</span>
            <span className="log-resource">{e.resource}</span>
            <span className={`log-decision decision-${e.decision}`}>{e.decision}</span>
            <span className="log-reason">{e.reason}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="hint">No decisions yet.</li>}
      </ul>
    </div>
  );
}
