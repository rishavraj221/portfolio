import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DecisionLogProvider } from "./context/DecisionLog";
import { LoginForm } from "./components/LoginForm";
import { ProtectedApp } from "./components/ProtectedApp";
import { AdminConsole } from "./components/AdminConsole";
import { DecisionLogPanel } from "./components/DecisionLogPanel";
import { AuditLogPanel } from "./components/AuditLogPanel";
import { PolicyVersionBadge } from "./components/PolicyVersionBadge";

type Tab = "app" | "admin";

function Shell() {
  const { accessToken, claims, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("app");

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <strong>rbac-demo</strong>
          <span className="hint"> -- a clone of the Flexday multi-tenant RBAC service</span>
        </div>
        {accessToken && (
          <div className="topbar-right">
            <PolicyVersionBadge />
            <span className="mono">{claims?.sub}</span>
            <button type="button" onClick={logout}>
              Log out
            </button>
          </div>
        )}
      </header>

      {!accessToken ? (
        <main className="main main-centered">
          <LoginForm />
        </main>
      ) : (
        <>
          <nav className="tabs">
            <button className={tab === "app" ? "tab tab-active" : "tab"} onClick={() => setTab("app")}>
              Protected app
            </button>
            <button className={tab === "admin" ? "tab tab-active" : "tab"} onClick={() => setTab("admin")}>
              Admin console
            </button>
          </nav>
          <main className="main main-grid">
            <div className="main-primary">{tab === "app" ? <ProtectedApp /> : <AdminConsole />}</div>
            <div className="main-secondary">
              <DecisionLogPanel />
              <AuditLogPanel />
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DecisionLogProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </DecisionLogProvider>
  );
}
