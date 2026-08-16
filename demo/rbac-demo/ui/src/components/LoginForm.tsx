import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

const QUICK_LOGINS = [
  { email: "admin@acme.test", label: "admin@acme.test", note: "Admin role" },
  { email: "alice@acme.test", label: "alice@acme.test", note: "Approver on Project Alpha" },
  { email: "bob@acme.test", label: "bob@acme.test", note: "Approver on Project Beta" },
  { email: "carol@acme.test", label: "carol@acme.test", note: "Viewer, no write access" },
];

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@acme.test");
  const [password, setPassword] = useState("password123");
  const [tenant, setTenant] = useState("acme");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password, tenant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Sign in</h2>
      <form onSubmit={submit} className="form">
        <label>
          Tenant slug
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="hint">Seeded demo users (run the seed script first):</p>
      <ul className="quick-logins">
        {QUICK_LOGINS.map((u) => (
          <li key={u.email}>
            <button
              type="button"
              className="link"
              onClick={() => {
                setEmail(u.email);
                setPassword("password123");
                setTenant("acme");
              }}
            >
              {u.label}
            </button>
            <span className="note">{u.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
