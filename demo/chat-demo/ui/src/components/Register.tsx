import { useState } from "react";
import { register } from "../lib/api";
import { requestNotificationPermission } from "../lib/notifications";

export default function Register({ onRegistered }: { onRegistered: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!name) return;

    setPending(true);
    setError(null);
    const result = await register(name);
    setPending(false);

    if (result.ok) {
      // Inside a click handler — the one reliable spot to ask, rather than
      // firing this unprompted on page load.
      requestNotificationPermission();
      onRegistered(name);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="shell">
      <form className="login" onSubmit={handleSubmit}>
        <h1>Wavelink demo</h1>
        <p className="muted">
          Enter a username to open your inbox. There's no password — the same name always opens
          the same inbox, so if you've used it before, this just reconnects you. Open this page in
          a second tab with a different one to talk to yourself.
        </p>
        <input
          autoFocus
          placeholder="your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" disabled={pending || !username.trim()}>
          {pending ? "Connecting…" : "Continue"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
