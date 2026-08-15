import { useState } from "react";
import type { ConversationSummary, DirectoryUser } from "../lib/types";
import { createGroup } from "../lib/api";

export default function NewGroupPanel({
  userId,
  users,
  onClose,
  onCreated,
}: {
  userId: string;
  users: DirectoryUser[];
  onClose: () => void;
  onCreated: (conversation: ConversationSummary) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(username: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selected.size === 0) return;

    setPending(true);
    setError(null);
    const result = await createGroup(userId, name.trim(), Array.from(selected));
    setPending(false);

    if (result.ok) {
      onCreated(result.conversation);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="panel">
      <header>
        <button className="back" type="button" onClick={onClose}>
          ← Back
        </button>
        <span className="title">New group</span>
      </header>

      <form className="composer groupform" onSubmit={handleCreate}>
        <input
          autoFocus
          className="search"
          placeholder="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="userlist">
          {users.length === 0 && <p className="muted">No other registered users yet.</p>}
          {users.map((u) => (
            <button
              key={u.username}
              type="button"
              className={`userrow ${selected.has(u.username) ? "selected" : ""}`}
              onClick={() => toggle(u.username)}
            >
              <span className={`dot ${u.online ? "online" : "offline"}`} />
              <span className="uname">{u.username}</span>
              {selected.has(u.username) && <span className="status">selected</span>}
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={pending || !name.trim() || selected.size === 0}>
          {pending ? "Creating…" : `Create group (${selected.size} member${selected.size === 1 ? "" : "s"})`}
        </button>
      </form>
    </div>
  );
}
